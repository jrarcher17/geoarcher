import { after } from "next/server";
import { prisma } from "@/lib/db";
import { runScan } from "@/lib/scan-runner";
import { runSeoAudit } from "@/lib/seo/audit-runner";
import { getTemporalClient, temporalConfigured } from "@/temporal/client";
import { AUTOPILOT_TASK_QUEUE, leadGenWorkflowId } from "@/temporal/shared";

/**
 * Background job starters used by API routes. Temporal-first for durability
 * (survives serverless timeouts, worker restarts, transient failures); falls
 * back to Next.js `after()` when Temporal is unconfigured or unreachable so
 * the product keeps working without a worker.
 */

type StartedVia = "temporal" | "inline";

async function startWorkflow(
  workflowType: string,
  workflowId: string,
  args: unknown[]
): Promise<boolean> {
  if (!temporalConfigured()) return false;
  try {
    const client = await getTemporalClient();
    await client.workflow.start(workflowType, {
      workflowId,
      taskQueue: AUTOPILOT_TASK_QUEUE,
      args,
    });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "WorkflowExecutionAlreadyStartedError") {
      return true; // already running — treat as started
    }
    console.error(`[temporal] failed to start ${workflowType}, falling back:`, err);
    return false;
  }
}

async function runSeoAuditInline(siteId: string, scanId: string): Promise<void> {
  try {
    await runSeoAudit(siteId, scanId);
  } catch (err) {
    console.error("[seo-audit] failed:", err);
    await prisma.seoAudit.updateMany({
      where: { scanId, status: "RUNNING" },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : "SEO audit failed.",
        finishedAt: new Date(),
      },
    });
  }
}

/** Crawl + GEO analysis for an existing scan row, optionally chaining the SEO audit. */
export async function startScanPipeline(options: {
  scanId: string;
  siteId: string;
  withSeoAudit: boolean;
}): Promise<StartedVia> {
  const { scanId, siteId, withSeoAudit } = options;
  const viaTemporal = await startWorkflow("scanPipelineWorkflow", `scan-${scanId}`, [
    { scanId, siteId, withSeoAudit },
  ]);
  if (viaTemporal) return "temporal";

  after(async () => {
    await runScan(scanId);
    if (!withSeoAudit) return;
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { status: true, pagesCrawled: true },
    });
    if (scan?.status === "COMPLETE" && scan.pagesCrawled > 0) {
      await runSeoAuditInline(siteId, scanId);
    }
  });
  return "inline";
}

/** SEO audit against an existing complete scan. */
export async function startSeoAuditJob(options: {
  siteId: string;
  scanId: string;
}): Promise<StartedVia> {
  const { siteId, scanId } = options;
  const viaTemporal = await startWorkflow("seoAuditWorkflow", `seo-audit-${scanId}`, [
    { siteId, scanId },
  ]);
  if (viaTemporal) return "temporal";

  after(() => runSeoAuditInline(siteId, scanId));
  return "inline";
}

/**
 * Start a Lead Generation campaign workflow. No `after()` fallback — this is a
 * multi-hour job that must run on the Temporal worker.
 */
export async function startLeadGenCampaign(campaignId: string): Promise<void> {
  if (!temporalConfigured()) {
    throw new Error(
      "The Lead Generation Machine needs Temporal configured. Set TEMPORAL_ADDRESS (or run `temporal server start-dev` locally) and start the worker."
    );
  }
  const client = await getTemporalClient();
  await client.workflow.start("leadGenCampaignWorkflow", {
    workflowId: leadGenWorkflowId(campaignId),
    taskQueue: AUTOPILOT_TASK_QUEUE,
    args: [{ campaignId }],
  });
}
