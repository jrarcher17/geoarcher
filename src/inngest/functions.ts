import { inngest } from "./client";
import { runLeadCampaignProgress } from "@/lib/leads/campaign-runner";
import { processFollowUps } from "@/lib/leads/pipeline";
import {
  notifyAutopilotCycle,
  notifyCampaignComplete,
  notifyScanComplete,
} from "@/lib/jobs/notify";
import { prisma } from "@/lib/db";
import { runAdvertisingIntelligence } from "@/lib/advertising/intelligence";
import { runScan } from "@/lib/scan-runner";
import { runSeoAudit } from "@/lib/seo/audit-runner";
import { runAutopilotCycle } from "@/lib/seo/autopilot-pipeline";
import { syncAllConnectedUsers, syncUserCampaignMetrics } from "@/lib/advertising/sync";

export const scanPipeline = inngest.createFunction(
  {
    id: "scan-pipeline",
    concurrency: { limit: 4 },
    retries: 2,
    triggers: { event: "scan/requested" },
  },
  async ({ event, step }) => {
    const { scanId, siteId, withSeoAudit } = event.data as {
      scanId: string;
      siteId: string;
      withSeoAudit: boolean;
    };

    await step.run("crawl-and-analyze", () => runScan(scanId));

    const scan = await step.run("check-scan", () =>
      prisma.scan.findUnique({
        where: { id: scanId },
        select: { status: true, pagesCrawled: true, benchmarkScanId: true },
      })
    );
    const scanOk = scan?.status === "COMPLETE" && (scan.pagesCrawled ?? 0) > 0;

    // Advertising intelligence: extract business profile, offerings, images
    // and ad opportunities from the fresh crawl (skip competitor benchmarks).
    if (scanOk && !scan.benchmarkScanId) {
      await step.run("advertising-intelligence", () =>
        runAdvertisingIntelligence(siteId, scanId)
      );
    }

    if (withSeoAudit) {
      if (scanOk) {
        await step.run("seo-audit", async () => {
          try {
            await runSeoAudit(siteId, scanId);
          } catch (err) {
            await prisma.seoAudit.updateMany({
              where: { scanId, status: "RUNNING" },
              data: {
                status: "FAILED",
                error: err instanceof Error ? err.message : "SEO audit failed.",
                finishedAt: new Date(),
              },
            });
            throw err;
          }
        });
      }
    }

    await step.run("email", () => notifyScanComplete(scanId));
  }
);

export const seoAuditJob = inngest.createFunction(
  {
    id: "seo-audit",
    retries: 2,
    triggers: { event: "seo/audit.requested" },
  },
  async ({ event, step }) => {
    const { siteId, scanId } = event.data as { siteId: string; scanId: string };
    await step.run("audit", async () => {
      try {
        await runSeoAudit(siteId, scanId);
      } catch (err) {
        await prisma.seoAudit.updateMany({
          where: { scanId, status: "RUNNING" },
          data: {
            status: "FAILED",
            error: err instanceof Error ? err.message : "SEO audit failed.",
            finishedAt: new Date(),
          },
        });
        throw err;
      }
    });
  }
);

export const leadCampaignJob = inngest.createFunction(
  {
    id: "lead-campaign",
    concurrency: { limit: 1, key: "event.data.campaignId" },
    retries: 2,
    triggers: { event: "leads/campaign.requested" },
  },
  async ({ event, step }) => {
    const campaignId = String(event.data.campaignId);
    let done = false;
    for (let i = 0; i < 200 && !done; i++) {
      const result = await step.run(`slice-${i}`, () =>
        runLeadCampaignProgress(campaignId)
      );
      done = result.done;
      if (!done) {
        await step.sleep(`pause-${i}`, result.busy ? "45s" : "2s");
      }
    }
    await step.run("email", () => notifyCampaignComplete(campaignId));
  }
);

export const leadFollowups = inngest.createFunction(
  {
    id: "lead-followups",
    retries: 1,
    triggers: { cron: "0 14 * * *" },
  },
  async ({ step }) => {
    const campaigns = await step.run("list", () =>
      prisma.leadCampaign.findMany({
        where: {
          prospects: { some: { status: "CONTACTED" } },
        },
        select: { id: true },
      })
    );
    for (const campaign of campaigns) {
      await step.run(`followup-${campaign.id}`, () =>
        processFollowUps(campaign.id)
      );
    }
    return { campaigns: campaigns.length };
  }
);

/** On-demand advertising-intelligence extraction for an already-scanned site. */
export const adIntelligenceJob = inngest.createFunction(
  {
    id: "advertising-intelligence",
    concurrency: { limit: 1, key: "event.data.siteId" },
    retries: 1,
    triggers: { event: "advertising/intelligence.requested" },
  },
  async ({ event, step }) => {
    const siteId = String(event.data.siteId);
    const scanId = event.data.scanId ? String(event.data.scanId) : undefined;
    return step.run("extract", () => runAdvertisingIntelligence(siteId, scanId));
  }
);

export const autopilotJob = inngest.createFunction(
  {
    id: "seo-autopilot",
    concurrency: { limit: 1, key: "event.data.siteId" },
    retries: 1,
    triggers: { event: "autopilot/run" },
  },
  async ({ event, step }) => {
    const siteId = String(event.data.siteId);
    const result = await step.run("cycle", () => runAutopilotCycle(siteId));
    await step.run("email", () => notifyAutopilotCycle(siteId, result.ok));
    if (!result.continue) return;
    const still = await step.run("still-enabled", () =>
      prisma.site.findUnique({
        where: { id: siteId },
        select: { autopilotEnabled: true },
      })
    );
    if (still?.autopilotEnabled) {
      await step.sendEvent("requeue", {
        name: "autopilot/run",
        data: { siteId },
        ts: Date.now() + result.intervalMs,
      });
    }
  }
);

/** Pull real platform metrics into CampaignMetric. Event or every 6 hours. */
export const adsMetricsSyncJob = inngest.createFunction(
  {
    id: "ads-metrics-sync",
    retries: 1,
    triggers: [{ event: "ads/metrics.sync" }, { cron: "0 */6 * * *" }],
  },
  async ({ event, step }) => {
    const userId =
      event.name === "ads/metrics.sync" && event.data && typeof event.data === "object"
        ? String((event.data as { userId?: string }).userId ?? "")
        : "";
    if (userId) {
      return step.run("user", () => syncUserCampaignMetrics(userId, 30));
    }
    return step.run("all", () => syncAllConnectedUsers(30));
  }
);
