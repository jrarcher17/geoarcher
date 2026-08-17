import { heartbeat } from "@temporalio/activity";
import { prisma } from "@/lib/db";
import { runScan } from "@/lib/scan-runner";
import { runSeoAudit } from "@/lib/seo/audit-runner";
import { dataForSeoConfigured } from "@/lib/seo/dataforseo";
import { runRankCheck } from "@/lib/seo/rank-tracker";

/**
 * Activities for the continuous SEO Autopilot workflow. Thin wrappers around
 * the existing pipeline functions — Temporal supplies retries, timeouts and
 * durability; the underlying logic is unchanged from the manual flows.
 */

/** Keeps the activity alive in Temporal's eyes while a long promise runs. */
async function withHeartbeat<T>(work: Promise<T>): Promise<T> {
  const timer = setInterval(() => heartbeat(), 15_000);
  try {
    return await work;
  } finally {
    clearInterval(timer);
  }
}

export interface AccessCheck {
  ok: boolean;
  reason: string | null;
  intervalMs: number;
}

/** Pro gate re-checked every cycle so lapsed subscriptions stop consuming. */
export async function checkAccess(siteId: string): Promise<AccessCheck> {
  const intervalDays = Number(process.env.AUTOPILOT_INTERVAL_DAYS ?? 7);
  const intervalMs = Math.max(1, intervalDays) * 24 * 60 * 60 * 1000;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      autopilotEnabled: true,
      userSites: { select: { user: { select: { plan: true } } } },
    },
  });
  if (!site) return { ok: false, reason: "Site was deleted.", intervalMs };
  if (!site.autopilotEnabled) {
    return { ok: false, reason: "Autopilot was turned off.", intervalMs };
  }
  const hasPro = site.userSites.some((us) => us.user.plan === "PRO");
  if (!hasPro) {
    return {
      ok: false,
      reason: "Autopilot stopped: the site no longer has a Pro subscriber.",
      intervalMs,
    };
  }
  return { ok: true, reason: null, intervalMs };
}

export async function disableAutopilot(
  siteId: string,
  reason: string
): Promise<void> {
  await prisma.site
    .update({ where: { id: siteId }, data: { autopilotEnabled: false } })
    .catch(() => undefined); // site may already be deleted
  await prisma.autopilotRun.create({
    data: { siteId, status: "STOPPED", error: reason, finishedAt: new Date() },
  }).catch(() => undefined);
}

// ---- Run bookkeeping ----

export interface StepResult {
  step: string;
  status: "ok" | "failed" | "skipped";
  detail: string;
}

export async function startRun(
  siteId: string,
  workflowRunId: string
): Promise<string> {
  const run = await prisma.autopilotRun.create({
    data: { siteId, workflowRunId, status: "RUNNING" },
  });
  return run.id;
}

export async function updateRunSteps(
  runId: string,
  steps: StepResult[]
): Promise<void> {
  await prisma.autopilotRun.update({
    where: { id: runId },
    data: { steps: JSON.parse(JSON.stringify(steps)) },
  });
}

export async function finishRun(
  runId: string,
  outcome: {
    status: "COMPLETE" | "FAILED";
    steps: StepResult[];
    changes?: ScanChanges | null;
    error?: string | null;
  }
): Promise<void> {
  await prisma.autopilotRun.update({
    where: { id: runId },
    data: {
      status: outcome.status,
      steps: JSON.parse(JSON.stringify(outcome.steps)),
      changes: outcome.changes
        ? JSON.parse(JSON.stringify(outcome.changes))
        : undefined,
      error: outcome.error ?? null,
      finishedAt: new Date(),
    },
  });
}

// ---- Pipeline stages ----

/** Run an existing scan row to completion (crawl + GEO analysis). */
export async function runScanById(scanId: string): Promise<void> {
  await withHeartbeat(runScan(scanId));

  const finished = await prisma.scan.findUniqueOrThrow({
    where: { id: scanId },
    select: { status: true, error: true },
  });
  if (finished.status !== "COMPLETE") {
    throw new Error(finished.error ?? `Scan ended with status ${finished.status}.`);
  }
}

/** Crawl the site and run GEO analysis. Returns the new scan id. */
export async function runFullScan(siteId: string): Promise<string> {
  // Reuse an already-active scan instead of double-crawling (e.g. a manual
  // scan the user just started).
  const active = await prisma.scan.findFirst({
    where: {
      siteId,
      benchmarkScanId: null,
      status: { in: ["QUEUED", "CRAWLING", "ANALYZING"] },
    },
    orderBy: { createdAt: "desc" },
  });
  const scan =
    active ?? (await prisma.scan.create({ data: { siteId } }));

  await runScanById(scan.id);
  return scan.id;
}

/** Full SEO audit with all AI stages against the given scan. */
export async function runSeoAuditStage(
  siteId: string,
  scanId: string
): Promise<void> {
  try {
    await withHeartbeat(runSeoAudit(siteId, scanId));
  } catch (err) {
    // Don't leave a stuck RUNNING audit behind for the UI to wait on.
    await prisma.seoAudit
      .updateMany({
        where: { scanId, status: "RUNNING" },
        data: {
          status: "FAILED",
          error: err instanceof Error ? err.message : "SEO audit failed.",
          finishedAt: new Date(),
        },
      })
      .catch(() => undefined);
    throw err;
  }
}

/** Re-crawl the competitors tracked on the previous scan against the new one. */
export async function syncCompetitors(
  siteId: string,
  scanId: string
): Promise<string> {
  const previous = await prisma.scan.findFirst({
    where: {
      siteId,
      benchmarkScanId: null,
      status: "COMPLETE",
      id: { not: scanId },
    },
    orderBy: { createdAt: "desc" },
    include: {
      competitorScans: { include: { site: { select: { id: true, url: true } } } },
    },
  });
  const competitors = previous?.competitorScans ?? [];
  if (competitors.length === 0) return "No competitors tracked.";

  const seen = new Set<string>();
  let recrawled = 0;
  for (const comp of competitors) {
    if (seen.has(comp.site.url)) continue;
    seen.add(comp.site.url);
    const newScan = await prisma.scan.create({
      data: { siteId: comp.site.id, benchmarkScanId: scanId },
    });
    await withHeartbeat(runScan(newScan.id));
    recrawled += 1;
  }
  return `Re-crawled ${recrawled} competitor site${recrawled === 1 ? "" : "s"}.`;
}

/** Refresh keyword rankings; skipped when unconfigured or nothing tracked. */
export async function runRankCheckStage(siteId: string): Promise<string> {
  if (!dataForSeoConfigured()) return "skipped: DataForSEO not configured";
  const keywordCount = await prisma.seoKeyword.count({ where: { siteId } });
  if (keywordCount === 0) return "skipped: no keywords tracked";
  const checked = await withHeartbeat(runRankCheck(siteId));
  return `Checked ${checked} keyword${checked === 1 ? "" : "s"}.`;
}

// ---- Change detection ----

export interface ScanChanges {
  newPages: string[];
  removedPages: string[];
  changedPages: { url: string; what: string }[];
  comparedToScanId: string | null;
}

/** Diff the new scan's pages against the previous complete scan. */
export async function detectChanges(
  siteId: string,
  scanId: string
): Promise<ScanChanges> {
  const previous = await prisma.scan.findFirst({
    where: {
      siteId,
      benchmarkScanId: null,
      status: "COMPLETE",
      id: { not: scanId },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!previous) {
    return { newPages: [], removedPages: [], changedPages: [], comparedToScanId: null };
  }

  const select = { url: true, title: true, wordCount: true } as const;
  const [currentPages, previousPages] = await Promise.all([
    prisma.page.findMany({ where: { scanId }, select }),
    prisma.page.findMany({ where: { scanId: previous.id }, select }),
  ]);

  const prevByUrl = new Map(previousPages.map((p) => [p.url, p]));
  const currUrls = new Set(currentPages.map((p) => p.url));

  const newPages: string[] = [];
  const changedPages: { url: string; what: string }[] = [];
  for (const page of currentPages) {
    const old = prevByUrl.get(page.url);
    if (!old) {
      newPages.push(page.url);
      continue;
    }
    const what: string[] = [];
    if ((old.title ?? "") !== (page.title ?? "")) what.push("title changed");
    const oldWords = old.wordCount || 1;
    const delta = Math.abs(page.wordCount - old.wordCount) / oldWords;
    if (delta >= 0.2) {
      what.push(
        page.wordCount > old.wordCount
          ? `content grew (${old.wordCount} to ${page.wordCount} words)`
          : `content shrank (${old.wordCount} to ${page.wordCount} words)`
      );
    }
    if (what.length > 0) changedPages.push({ url: page.url, what: what.join("; ") });
  }
  const removedPages = previousPages
    .filter((p) => !currUrls.has(p.url))
    .map((p) => p.url);

  return {
    newPages: newPages.slice(0, 50),
    removedPages: removedPages.slice(0, 50),
    changedPages: changedPages.slice(0, 50),
    comparedToScanId: previous.id,
  };
}
