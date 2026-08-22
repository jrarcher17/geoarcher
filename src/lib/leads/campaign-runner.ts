import { after } from "next/server";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/stripe";
import {
  analyzeProspect,
  checkLeadGenAccess,
  countLiveProspects,
  findCompanies,
  listPendingProspects,
  markCampaignStatus,
  prepareOutreach,
  reclassifyUnhealthySkips,
  sendOutreach,
} from "@/temporal/lead-activities";

const ANALYZE_BATCH = 3;
const STUCK_ANALYZING_MS = 3 * 60_000;
const OTHER_WORKER_MS = 45_000;

const inFlight = new Set<string>();

export type LeadProgressResult = {
  done: boolean;
  busy: boolean;
  found: number;
  analyzed: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function campaignNeedsWork(campaignId: string): Promise<boolean> {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true, targetCount: true },
  });
  if (!campaign || campaign.status !== "RUNNING") return false;

  const pending = await prisma.prospect.count({
    where: {
      campaignId,
      status: { in: ["FOUND", "ANALYZING"] },
    },
  });
  const live = await countLiveProspects(campaignId);
  return pending > 0 || live < campaign.targetCount;
}

async function resetStuckAnalyzing(campaignId: string): Promise<void> {
  await prisma.prospect.updateMany({
    where: {
      campaignId,
      status: "ANALYZING",
      updatedAt: { lte: new Date(Date.now() - STUCK_ANALYZING_MS) },
    },
    data: { status: "FOUND", error: null },
  });
}

/** Another process is mid-crawl — do not steal the same prospect. */
async function otherWorkerActive(campaignId: string): Promise<boolean> {
  const analyzing = await prisma.prospect.findFirst({
    where: {
      campaignId,
      status: "ANALYZING",
      updatedAt: { gte: new Date(Date.now() - OTHER_WORKER_MS) },
    },
    select: { id: true },
  });
  return Boolean(analyzing);
}

/**
 * One slice of a campaign: Apollo find (if under target) + a small analyze
 * batch. Closing the browser does not stop this — it runs on the server.
 */
export async function runLeadCampaignProgress(
  campaignId: string
): Promise<LeadProgressResult> {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true, targetCount: true },
  });
  if (!campaign || campaign.status !== "RUNNING") {
    return { done: true, busy: false, found: 0, analyzed: 0 };
  }
  const liveCount = await countLiveProspects(campaignId);

  await resetStuckAnalyzing(campaignId);

  if (await otherWorkerActive(campaignId)) {
    return { done: false, busy: true, found: 0, analyzed: 0 };
  }

  const access = await checkLeadGenAccess(campaignId);
  if (!access.ok) {
    await markCampaignStatus(campaignId, "FAILED", access.reason);
    return { done: true, busy: false, found: 0, analyzed: 0 };
  }

  const flipped = await reclassifyUnhealthySkips(campaignId);
  for (const id of flipped) {
    const prep = await prepareOutreach(id);
    if (prep === "ready" && access.mode === "AUTO_SEND") {
      await sendOutreach(id);
    }
  }

  let found = 0;
  let searchExhausted = false;
  const recentFind = await prisma.prospect.findFirst({
    where: {
      campaignId,
      status: "FOUND",
      createdAt: { gte: new Date(Date.now() - OTHER_WORKER_MS) },
    },
    select: { id: true },
  });
  const findInProgress =
    Boolean(recentFind) && liveCount < campaign.targetCount;

  if (liveCount < campaign.targetCount && !findInProgress) {
    const result = await findCompanies(campaignId);
    found = result.created;
    searchExhausted = result.exhausted;
    if (found === 0 && (await countLiveProspects(campaignId)) === 0) {
      await markCampaignStatus(
        campaignId,
        "FAILED",
        result.detail || "No companies found."
      );
      return { done: true, busy: false, found: 0, analyzed: 0 };
    }
  }

  const ids = await listPendingProspects(campaignId, ANALYZE_BATCH);
  let analyzed = 0;
  for (const id of ids) {
    const still = await prisma.leadCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (still?.status !== "RUNNING") {
      return { done: true, busy: false, found, analyzed };
    }
    const outcome = await analyzeProspect(id);
    analyzed += 1;
    if (outcome !== "QUALIFIED") continue;
    const prep = await prepareOutreach(id);
    if (prep === "ready" && access.mode === "AUTO_SEND") {
      await sendOutreach(id);
    }
  }

  const pending = await prisma.prospect.count({
    where: { campaignId, status: { in: ["FOUND", "ANALYZING"] } },
  });
  const live = await countLiveProspects(campaignId);
  if (pending === 0 && live >= campaign.targetCount) {
    await markCampaignStatus(campaignId, "COMPLETE");
    return { done: true, busy: false, found, analyzed };
  }
  if (pending === 0 && live < campaign.targetCount && searchExhausted) {
    await markCampaignStatus(
      campaignId,
      "COMPLETE",
      `Found ${live} live websites (asked for ${campaign.targetCount}). Apollo has no more companies for this search. Try a broader location.`
    );
    return { done: true, busy: false, found, analyzed };
  }
  if (pending === 0 && live < campaign.targetCount && found === 0 && !findInProgress) {
    // Find was skipped this slice (recent batch still settling) — keep going.
    return { done: false, busy: false, found, analyzed };
  }

  return { done: false, busy: false, found, analyzed };
}

async function scheduleNextSlice(campaignId: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const base = appBaseUrl().replace(/\/$/, "");
  if (secret) {
    after(async () => {
      try {
        const res = await fetch(`${base}/api/cron/leads`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ campaignId }),
        });
        if (!res.ok) {
          console.error(
            `[leads] continue tick failed: ${res.status} ${await res.text()}`
          );
          await kickLeadCampaignWork(campaignId, 1_000);
        }
      } catch (err) {
        console.error("[leads] continue tick failed:", err);
        await kickLeadCampaignWork(campaignId, 1_000);
      }
    });
    return;
  }

  after(() => kickLeadCampaignWork(campaignId, 1_000));
}

/**
 * Run one slice, then enqueue the next so a 25-prospect overnight job
 * survives request timeouts and a closed browser.
 */
export async function kickLeadCampaignWork(
  campaignId: string,
  graceMs = 0
): Promise<void> {
  if (inFlight.has(campaignId)) return;
  inFlight.add(campaignId);
  try {
    if (graceMs > 0) await sleep(graceMs);
    const result = await runLeadCampaignProgress(campaignId);
    if (result.done) return;
    if (result.busy) {
      after(() => kickLeadCampaignWork(campaignId, OTHER_WORKER_MS));
      return;
    }
    await scheduleNextSlice(campaignId);
  } catch (err) {
    console.error("[leads] campaign progress failed:", err);
    await prisma.leadCampaign
      .update({
        where: { id: campaignId },
        data: {
          error: err instanceof Error ? err.message : "Campaign step failed.",
        },
      })
      .catch(() => undefined);
    if (await campaignNeedsWork(campaignId)) {
      await scheduleNextSlice(campaignId);
    }
  } finally {
    inFlight.delete(campaignId);
  }
}

export async function resumeLeadCampaigns(options?: {
  campaignId?: string;
  userId?: string;
}): Promise<{ resumed: string[] }> {
  if (options?.campaignId) {
    await kickLeadCampaignWork(options.campaignId, 0);
    return { resumed: [options.campaignId] };
  }

  const campaigns = await prisma.leadCampaign.findMany({
    where: {
      status: "RUNNING",
      ...(options?.userId ? { userId: options.userId } : {}),
    },
    select: { id: true, targetCount: true },
  });

  const resumed: string[] = [];
  for (const campaign of campaigns) {
    if (!(await campaignNeedsWork(campaign.id))) {
      await markCampaignStatus(campaign.id, "COMPLETE");
      continue;
    }
    resumed.push(campaign.id);
    after(() => kickLeadCampaignWork(campaign.id, 0));
  }
  return { resumed };
}

/** @deprecated use kickLeadCampaignWork */
export async function kickLeadDiscoverIfIdle(
  campaignId: string,
  graceMs = 0
): Promise<void> {
  await kickLeadCampaignWork(campaignId, graceMs);
}
