import { prisma } from "./db";
import { compareScans, countFaqDelta, snapshotFromDb } from "./scan-diff";
import type { ScanComparison } from "./scan-diff";

export interface ScanHistoryEntry {
  id: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  pagesCrawled: number;
  geoOverall: number | null;
  understanding: number | null;
  simulationAfter: number | null;
}

export async function getSiteHistoryForScan(
  scanId: string,
  limit = 12
): Promise<{ siteUrl: string; entries: ScanHistoryEntry[] } | null> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { site: true },
  });
  if (!scan) return null;

  const scans = await prisma.scan.findMany({
    where: { siteId: scan.siteId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { analysis: true, simulation: true },
  });

  const entries: ScanHistoryEntry[] = scans.map((s) => {
    const understanding = s.analysis?.understanding as
      | { confidence?: number }
      | undefined;
    const geo = s.analysis?.geoScore as { overall?: number } | undefined;
    const sim = s.simulation?.results as { overallAfter?: number } | null;
    return {
      id: s.id,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      finishedAt: s.finishedAt?.toISOString() ?? null,
      pagesCrawled: s.pagesCrawled,
      geoOverall: geo?.overall ?? null,
      understanding: understanding?.confidence ?? null,
      simulationAfter:
        s.simulation?.status === "COMPLETE" ? (sim?.overallAfter ?? null) : null,
    };
  });

  return { siteUrl: scan.site.url, entries };
}

export async function compareToPreviousScan(
  scanId: string
): Promise<ScanComparison | null> {
  const current = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      analysis: true,
      simulation: true,
      pages: { select: { url: true, wordCount: true, extracted: true } },
    },
  });
  if (!current || current.status !== "COMPLETE" || !current.analysis) {
    return null;
  }

  const baseline = await prisma.scan.findFirst({
    where: {
      siteId: current.siteId,
      status: "COMPLETE",
      finishedAt: { lt: current.finishedAt ?? current.createdAt },
      id: { not: current.id },
    },
    orderBy: { finishedAt: "desc" },
    include: {
      analysis: true,
      simulation: true,
      pages: { select: { url: true, wordCount: true, extracted: true } },
    },
  });
  if (!baseline?.analysis) return null;

  const currentSnap = snapshotFromDb({
    scanId: current.id,
    finishedAt: current.finishedAt,
    pages: current.pages,
    analysis: current.analysis,
    simulationResults:
      current.simulation?.status === "COMPLETE"
        ? current.simulation.results
        : null,
  });
  const baselineSnap = snapshotFromDb({
    scanId: baseline.id,
    finishedAt: baseline.finishedAt,
    pages: baseline.pages,
    analysis: baseline.analysis,
    simulationResults:
      baseline.simulation?.status === "COMPLETE"
        ? baseline.simulation.results
        : null,
  });

  const comparison = compareScans(baselineSnap, currentSnap);
  const faqDelta = countFaqDelta(baseline.pages, current.pages);
  if (faqDelta > 0) {
    comparison.highlights.unshift(
      `You added ${faqDelta} FAQ${faqDelta === 1 ? "" : "s"} (detected in crawl)`
    );
  }

  return comparison;
}

/** Sites whose latest completed scan is older than `intervalDays` and have no active scan. */
export async function findSitesDueForRecrawl(intervalDays = 7) {
  const cutoff = new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000);
  const sites = await prisma.site.findMany({ include: { scans: true } });
  const due: { siteId: string; url: string; lastScanId: string }[] = [];

  for (const site of sites) {
    const active = site.scans.some((s) =>
      ["QUEUED", "CRAWLING", "ANALYZING"].includes(s.status)
    );
    if (active) continue;

    const latestComplete = site.scans
      .filter((s) => s.status === "COMPLETE" && s.finishedAt)
      .sort(
        (a, b) =>
          (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0)
      )[0];

    if (!latestComplete?.finishedAt) continue;
    if (latestComplete.finishedAt > cutoff) continue;

    due.push({
      siteId: site.id,
      url: site.url,
      lastScanId: latestComplete.id,
    });
  }
  return due;
}
