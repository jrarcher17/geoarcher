import { after } from "next/server";
import { prisma } from "@/lib/db";
import { inngest, inngestConfigured } from "@/inngest/client";
import { runLeadCampaignProgress } from "@/lib/leads/campaign-runner";
import { runScan } from "@/lib/scan-runner";
import { runSeoAudit } from "@/lib/seo/audit-runner";

async function runScanPipelineInline(scanId: string): Promise<void> {
  await runScan(scanId);
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

async function sendOrInline(
  event: { name: string; data: Record<string, unknown> },
  fallback: () => Promise<void>
): Promise<void> {
  try {
    await inngest.send({ name: event.name, data: event.data });
  } catch (err) {
    console.error(`[inngest] ${event.name} send failed — running inline:`, err);
    after(() => fallback());
  }
}

export async function startScanPipeline(options: {
  scanId: string;
  siteId: string;
}): Promise<"inngest" | "inline"> {
  const { scanId, siteId } = options;
  try {
    await inngest.send({
      name: "scan/requested",
      data: { scanId, siteId },
    });
    return "inngest";
  } catch (err) {
    console.error("[inngest] scan send failed — running inline:", err);
    after(() => runScanPipelineInline(scanId));
    return "inline";
  }
}

export async function startSeoAuditJob(options: {
  siteId: string;
  scanId: string;
}): Promise<"inngest" | "inline"> {
  const { siteId, scanId } = options;
  await prisma.seoAudit.upsert({
    where: { scanId },
    create: { siteId, scanId, status: "RUNNING" },
    update: { status: "RUNNING", error: null, finishedAt: null },
  });
  try {
    await inngest.send({
      name: "seo/audit.requested",
      data: { siteId, scanId },
    });
    return "inngest";
  } catch (err) {
    console.error("[inngest] SEO audit send failed — running inline:", err);
    after(() => runSeoAuditInline(siteId, scanId));
    return "inline";
  }
}

export async function startLeadGenCampaign(campaignId: string): Promise<void> {
  await sendOrInline({ name: "leads/campaign.requested", data: { campaignId } }, async () => {
    let done = false;
    let slices = 0;
    while (!done && slices < 80) {
      const result = await runLeadCampaignProgress(campaignId);
      done = result.done;
      slices += 1;
    }
  });
}

export async function startAdvertisingIntelligence(
  siteId: string,
  scanId?: string
): Promise<void> {
  const { runAdvertisingIntelligence } = await import(
    "@/lib/advertising/intelligence"
  );
  await sendOrInline(
    { name: "advertising/intelligence.requested", data: { siteId, scanId } },
    async () => {
      await runAdvertisingIntelligence(siteId, scanId);
    }
  );
}

export async function startAutopilot(
  siteId: string,
  options?: { force?: boolean }
): Promise<void> {
  await inngest.send({
    name: "autopilot/run",
    data: { siteId, force: Boolean(options?.force) },
  });
}

export async function startAdsMetricSync(userId: string): Promise<void> {
  const { syncUserCampaignMetrics } = await import("@/lib/advertising/sync");
  await sendOrInline(
    { name: "ads/metrics.sync", data: { userId } },
    () => syncUserCampaignMetrics(userId, 30).then(() => undefined)
  );
}

export { inngestConfigured };
