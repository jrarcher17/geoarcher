import { after } from "next/server";
import { prisma } from "@/lib/db";
import { runScan } from "@/lib/scan-runner";
import { runSeoAudit } from "@/lib/seo/audit-runner";
import { findCompanies } from "@/temporal/lead-activities";
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

const WORKER_GRACE_MS = Number(process.env.TEMPORAL_WORKER_GRACE_MS ?? 15_000);

async function runScanPipelineInline(
  scanId: string,
  siteId: string,
  withSeoAudit: boolean
): Promise<void> {
  await runScan(scanId);
  if (!withSeoAudit) return;
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { status: true, pagesCrawled: true },
  });
  if (scan?.status === "COMPLETE" && scan.pagesCrawled > 0) {
    await runSeoAuditInline(siteId, scanId);
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
  if (viaTemporal) {
    // Temporal Cloud only *queues* the job. If no worker is polling, the scan
    // stays QUEUED until the 5-minute stale timer fails it. Run it here if
    // the worker does not claim it quickly — closing the tab still works.
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, WORKER_GRACE_MS));
      const scan = await prisma.scan.findUnique({
        where: { id: scanId },
        select: { status: true, pagesCrawled: true },
      });
      if (!scan || scan.status !== "QUEUED" || scan.pagesCrawled > 0) return;
      console.warn(
        `[temporal] scan ${scanId} still queued after ${WORKER_GRACE_MS}ms — running inline. Start \`pnpm worker\` for Temporal Cloud.`
      );
      await runScanPipelineInline(scanId, siteId, withSeoAudit);
    });
    return "temporal";
  }

  after(() => runScanPipelineInline(scanId, siteId, withSeoAudit));
  return "inline";
}

/** SEO audit against an existing complete scan. */
export async function startSeoAuditJob(options: {
  siteId: string;
  scanId: string;
}): Promise<StartedVia> {
  const { siteId, scanId } = options;

  // Persist RUNNING immediately so the Autopilot UI has something to poll.
  // runSeoAudit replaces this row once it actually starts computing.
  await prisma.seoAudit.upsert({
    where: { scanId },
    create: { siteId, scanId, status: "RUNNING" },
    update: { status: "RUNNING", error: null, finishedAt: null },
  });

  const viaTemporal = await startWorkflow("seoAuditWorkflow", `seo-audit-${scanId}`, [
    { siteId, scanId },
  ]);
  if (viaTemporal) {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, WORKER_GRACE_MS));
      const existing = await prisma.seoAudit.findUnique({
        where: { scanId },
        select: { status: true, overallScore: true },
      });
      if (
        existing?.status === "COMPLETE" ||
        (existing?.status === "RUNNING" && existing.overallScore != null)
      ) {
        return;
      }
      console.warn(
        `[temporal] SEO audit for scan ${scanId} still idle after ${WORKER_GRACE_MS}ms — running inline. Start \`pnpm worker\` for Temporal Cloud.`
      );
      await runSeoAuditInline(siteId, scanId);
    });
    return "temporal";
  }

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
  after(() => kickLeadDiscoverIfIdle(campaignId, WORKER_GRACE_MS));
}

/**
 * If Temporal Cloud queued the campaign but no worker is polling, Apollo
 * never runs and the UI sits on "finding companies." Run discover in-process.
 */
const leadDiscoverStarted = new Set<string>();

export async function kickLeadDiscoverIfIdle(
  campaignId: string,
  graceMs = WORKER_GRACE_MS
): Promise<void> {
  if (leadDiscoverStarted.has(campaignId)) return;
  leadDiscoverStarted.add(campaignId);
  try {
    if (graceMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, graceMs));
    }
    const campaign = await prisma.leadCampaign.findUnique({
      where: { id: campaignId },
      include: { _count: { select: { prospects: true } } },
    });
    if (!campaign || campaign.status !== "RUNNING") return;
    if (campaign._count.prospects > 0) return;
    console.warn(
      `[temporal] lead campaign ${campaignId} still has 0 prospects — running Apollo search inline. Start \`pnpm worker\`.`
    );
    await findCompanies(campaignId);
  } catch (err) {
    console.error("[leads] inline discover failed:", err);
    await prisma.leadCampaign
      .update({
        where: { id: campaignId },
        data: {
          error: err instanceof Error ? err.message : "Could not find companies.",
        },
      })
      .catch(() => undefined);
  }
}
