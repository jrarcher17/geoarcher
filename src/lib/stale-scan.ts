import { prisma } from "./db";

const STALE_CRAWL_MS = Number(process.env.STALE_CRAWL_MS ?? 5 * 60 * 1000);
const KICKSTART_QUEUED_MS = Number(process.env.KICKSTART_QUEUED_MS ?? 15_000);
/** Orphaned CRAWLING (0 pages) after dev restart — reclaim before marking stale. */
const RECOVER_CRAWL_MS = Number(process.env.RECOVER_CRAWL_MS ?? 45_000);

const kickstartScheduled = new Set<string>();

/** Marks scans that lost their background worker (e.g. dev server restart). */
export async function failStaleScanIfNeeded(scan: {
  id: string;
  status: string;
  pagesCrawled: number;
  createdAt: Date;
  error: string | null;
}): Promise<{ status: string; error: string | null }> {
  const stuck =
    (scan.status === "QUEUED" || scan.status === "CRAWLING") &&
    scan.pagesCrawled === 0 &&
    Date.now() - scan.createdAt.getTime() > STALE_CRAWL_MS;

  if (!stuck) {
    return { status: scan.status, error: scan.error };
  }

  const error =
    "This scan was interrupted (often from restarting the dev server) or timed out connecting to the browser. Start a new scan.";

  await prisma.scan.update({
    where: { id: scan.id },
    data: {
      status: "FAILED",
      error,
      finishedAt: new Date(),
    },
  });

  return { status: "FAILED", error };
}

/**
 * Re-queue orphaned crawls and kickstart QUEUED scans whose worker never ran.
 * Call `scheduleRun` with Next.js `after(() => runScan(id))`.
 */
export async function kickstartScanIfNeeded(
  scan: {
    id: string;
    status: string;
    pagesCrawled: number;
    createdAt: Date;
  },
  scheduleRun: (scanId: string) => void
): Promise<{ status: string; recovered: boolean }> {
  const age = Date.now() - scan.createdAt.getTime();

  if (
    scan.status === "CRAWLING" &&
    scan.pagesCrawled === 0 &&
    age > RECOVER_CRAWL_MS &&
    age <= STALE_CRAWL_MS
  ) {
    const reset = await prisma.scan.updateMany({
      where: { id: scan.id, status: "CRAWLING", pagesCrawled: 0 },
      data: { status: "QUEUED" },
    });
    if (reset.count === 1) {
      kickstartScheduled.add(scan.id);
      scheduleRun(scan.id);
      return { status: "QUEUED", recovered: true };
    }
  }

  if (
    scan.status === "QUEUED" &&
    age > KICKSTART_QUEUED_MS &&
    !kickstartScheduled.has(scan.id)
  ) {
    kickstartScheduled.add(scan.id);
    scheduleRun(scan.id);
  }

  return { status: scan.status, recovered: false };
}
