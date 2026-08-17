import {
  condition,
  continueAsNew,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
  workflowInfo,
} from "@temporalio/workflow";
import type * as activities from "./activities";
import type { ScanChanges, StepResult } from "./activities";
import type * as leadActivities from "./lead-activities";

/**
 * Continuous SEO Autopilot: one workflow per site, looping
 * scan -> SEO audit -> competitors -> rankings -> change detection -> sleep.
 * Durable across worker restarts; continues-as-new after every cycle so the
 * event history stays bounded.
 */

// Long pipeline stages (crawls, AI audit) — heartbeat while running.
const pipeline = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 minutes",
  heartbeatTimeout: "2 minutes",
  retry: { maximumAttempts: 3, initialInterval: "30 seconds" },
});

// Quick DB reads/writes.
const db = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 5, initialInterval: "2 seconds" },
});

export const pauseSignal = defineSignal("pause");
export const resumeSignal = defineSignal("resume");
export const runNowSignal = defineSignal("runNow");

export interface AutopilotStatus {
  paused: boolean;
  currentStep: string;
  nextRunAt: string | null;
}

export const statusQuery = defineQuery<AutopilotStatus>("status");

export interface AutopilotInput {
  siteId: string;
  paused?: boolean;
}

// ---- One-shot pipelines (manual scans, rescans, competitors, cron) ----

export interface ScanPipelineInput {
  scanId: string;
  siteId: string;
  /** Chain the full SEO audit after the scan (Pro primary scans). */
  withSeoAudit: boolean;
}

/**
 * Durable one-shot scan: crawl + GEO analysis, optionally followed by the SEO
 * audit. Used for manual scans, rescans, competitor crawls and cron recrawls.
 * An audit failure doesn't fail the workflow — the scan results already stand
 * on their own, and the audit is marked FAILED in the database for the UI.
 */
export async function scanPipelineWorkflow(input: ScanPipelineInput): Promise<void> {
  await pipeline.runScanById(input.scanId);
  if (input.withSeoAudit) {
    try {
      await pipeline.runSeoAuditStage(input.siteId, input.scanId);
    } catch {
      // Recorded on the SeoAudit row by the activity.
    }
  }
}

export interface SeoAuditInput {
  siteId: string;
  scanId: string;
}

/** Durable one-shot SEO audit against an existing complete scan. */
export async function seoAuditWorkflow(input: SeoAuditInput): Promise<void> {
  await pipeline.runSeoAuditStage(input.siteId, input.scanId);
}

export async function siteAutopilotWorkflow(input: AutopilotInput): Promise<void> {
  let paused = input.paused ?? false;
  let runNow = false;
  let currentStep = "starting";
  let nextRunAt: string | null = null;

  setHandler(pauseSignal, () => {
    paused = true;
  });
  setHandler(resumeSignal, () => {
    paused = false;
    runNow = true;
  });
  setHandler(runNowSignal, () => {
    runNow = true;
  });
  setHandler(statusQuery, () => ({ paused, currentStep, nextRunAt }));

  if (paused) {
    currentStep = "paused";
    await condition(() => !paused);
  }
  runNow = false;

  // Pro gate re-checked every cycle; stop cleanly on downgrade or opt-out.
  const access = await db.checkAccess(input.siteId);
  if (!access.ok) {
    await db.disableAutopilot(input.siteId, access.reason ?? "Access revoked.");
    return;
  }

  const runId = await db.startRun(input.siteId, workflowInfo().runId);
  const steps: StepResult[] = [];
  let changes: ScanChanges | null = null;
  let fatal: string | null = null;

  const record = async (step: string, work: () => Promise<string>) => {
    currentStep = step;
    try {
      const detail = await work();
      steps.push({ step, status: detail.startsWith("skipped") ? "skipped" : "ok", detail });
    } catch (err) {
      steps.push({ step, status: "failed", detail: String(err).slice(0, 300) });
      throw err;
    } finally {
      await db.updateRunSteps(runId, steps);
    }
  };

  try {
    let scanId = "";
    await record("Scan & GEO analysis", async () => {
      scanId = await pipeline.runFullScan(input.siteId);
      return `Scan ${scanId} complete.`;
    });
    await record("SEO audit", async () => {
      await pipeline.runSeoAuditStage(input.siteId, scanId);
      return "Audit, opportunities, content plan, links and search topics refreshed.";
    });

    // Non-fatal stages: a competitor or ranking hiccup shouldn't fail the cycle.
    try {
      await record("Competitors", () => pipeline.syncCompetitors(input.siteId, scanId));
    } catch {
      /* recorded as failed step */
    }
    try {
      await record("Rankings", () => pipeline.runRankCheckStage(input.siteId));
    } catch {
      /* recorded as failed step */
    }

    await record("Change detection", async () => {
      changes = await db.detectChanges(input.siteId, scanId);
      const parts = [
        `${changes.newPages.length} new`,
        `${changes.changedPages.length} changed`,
        `${changes.removedPages.length} removed`,
      ];
      return changes.comparedToScanId
        ? `Pages vs previous scan: ${parts.join(", ")}.`
        : "First cycle — nothing to compare against yet.";
    });
  } catch (err) {
    fatal = String(err).slice(0, 500);
  }

  await db.finishRun(runId, {
    status: fatal ? "FAILED" : "COMPLETE",
    steps,
    changes,
    error: fatal,
  });

  // Sleep until the next cycle; a runNow signal wakes it early.
  runNow = false;
  currentStep = "sleeping";
  nextRunAt = new Date(Date.now() + access.intervalMs).toISOString();
  await condition(() => runNow, access.intervalMs);

  await continueAsNew<typeof siteAutopilotWorkflow>({
    siteId: input.siteId,
    paused,
  });
}

// ---- AI Lead Generation Machine ----

const leadPipeline = proxyActivities<typeof leadActivities>({
  startToCloseTimeout: "20 minutes",
  heartbeatTimeout: "2 minutes",
  retry: { maximumAttempts: 3, initialInterval: "20 seconds" },
});

const leadDb = proxyActivities<typeof leadActivities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 5, initialInterval: "2 seconds" },
});

export const leadPauseSignal = defineSignal("leadPause");
export const leadResumeSignal = defineSignal("leadResume");
export const leadCancelSignal = defineSignal("leadCancel");

export type LeadGenPhase = "discover" | "analyze" | "followup";

export interface LeadGenStatus {
  paused: boolean;
  cancelled: boolean;
  phase: LeadGenPhase;
  currentStep: string;
}

export const leadStatusQuery = defineQuery<LeadGenStatus>("leadStatus");

export interface LeadGenInput {
  campaignId: string;
  paused?: boolean;
  phase?: LeadGenPhase;
}

const ANALYZE_BATCH = 5;

/**
 * One workflow per campaign: find companies → analyze/score in batches →
 * reveal + report + outreach for qualified leads → daily follow-up pass.
 * continueAsNew between batches so history stays bounded.
 */
export async function leadGenCampaignWorkflow(
  input: LeadGenInput
): Promise<void> {
  let paused = input.paused ?? false;
  let cancelled = false;
  const phase: LeadGenPhase = input.phase ?? "discover";
  let currentStep = "starting";

  setHandler(leadPauseSignal, () => {
    paused = true;
  });
  setHandler(leadResumeSignal, () => {
    paused = false;
  });
  setHandler(leadCancelSignal, () => {
    cancelled = true;
    paused = false;
  });
  setHandler(leadStatusQuery, () => ({
    paused,
    cancelled,
    phase,
    currentStep,
  }));

  const waitIfPaused = async () => {
    if (paused && !cancelled) {
      currentStep = "paused";
      await condition(() => !paused || cancelled);
    }
  };

  const stopIfNeeded = async (): Promise<boolean> => {
    if (cancelled) {
      await leadDb.markCampaignStatus(input.campaignId, "CANCELLED");
      return true;
    }
    const access = await leadDb.checkLeadGenAccess(input.campaignId);
    if (!access.ok) {
      await leadDb.markCampaignStatus(
        input.campaignId,
        "FAILED",
        access.reason
      );
      return true;
    }
    return false;
  };

  await waitIfPaused();
  if (await stopIfNeeded()) return;

  if (phase === "discover") {
    currentStep = "finding companies";
    await leadPipeline.findCompanies(input.campaignId);
    await continueAsNew<typeof leadGenCampaignWorkflow>({
      campaignId: input.campaignId,
      paused,
      phase: "analyze",
    });
    return;
  }

  if (phase === "analyze") {
    currentStep = "analyzing prospects";
    const ids = await leadDb.listPendingProspects(
      input.campaignId,
      ANALYZE_BATCH
    );
    if (ids.length === 0) {
      await continueAsNew<typeof leadGenCampaignWorkflow>({
        campaignId: input.campaignId,
        paused,
        phase: "followup",
      });
      return;
    }

    const access = await leadDb.checkLeadGenAccess(input.campaignId);
    await Promise.all(
      ids.map(async (id) => {
        const outcome = await leadPipeline.analyzeProspect(id);
        if (outcome !== "QUALIFIED") return;
        const prep = await leadPipeline.prepareOutreach(id);
        if (prep === "ready" && access.mode === "AUTO_SEND") {
          await leadPipeline.sendOutreach(id);
        }
      })
    );

    await continueAsNew<typeof leadGenCampaignWorkflow>({
      campaignId: input.campaignId,
      paused,
      phase: "analyze",
    });
    return;
  }

  // followup phase — daily pass until nothing is pending.
  currentStep = "follow-ups";
  const result = await leadPipeline.processFollowUps(input.campaignId);
  if (result.pending === 0) {
    await leadDb.markCampaignStatus(input.campaignId, "COMPLETE");
    return;
  }

  currentStep = "waiting for follow-up window";
  await condition(() => cancelled, "24 hours");
  if (await stopIfNeeded()) return;

  await continueAsNew<typeof leadGenCampaignWorkflow>({
    campaignId: input.campaignId,
    paused,
    phase: "followup",
  });
}
