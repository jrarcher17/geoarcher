import type {
  ContentGap,
  GeoScore,
  PageExtraction,
  Recommendation,
  SimulationResults,
  Understanding,
} from "./types";

export interface ScanSnapshot {
  scanId: string;
  finishedAt: string | null;
  pages: { url: string; wordCount: number }[];
  understanding: Understanding | null;
  geoScore: GeoScore | null;
  contentGaps: ContentGap[];
  recommendations: Recommendation[];
  simulation: SimulationResults | null;
}

export interface ScanComparison {
  baselineScanId: string;
  baselineFinishedAt: string | null;
  currentScanId: string;
  scoreDeltas: {
    geoOverall: number | null;
    understanding: number | null;
    simulationAfter: number | null;
  };
  geoComponentDeltas: {
    name: string;
    before: number;
    after: number;
    delta: number;
  }[];
  resolvedGapQuestions: string[];
  newGaps: ContentGap[];
  newRecommendations: Recommendation[];
  pageChanges: {
    added: string[];
    removed: string[];
    wordCountChanges: { url: string; before: number; after: number; delta: number }[];
  };
  highlights: string[];
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function compareScans(
  baseline: ScanSnapshot,
  current: ScanSnapshot
): ScanComparison {
  const highlights: string[] = [];

  const geoBefore = baseline.geoScore?.overall ?? null;
  const geoAfter = current.geoScore?.overall ?? null;
  const uBefore = baseline.understanding?.confidence ?? null;
  const uAfter = current.understanding?.confidence ?? null;
  const simBefore = baseline.simulation?.overallAfter ?? null;
  const simAfter = current.simulation?.overallAfter ?? null;

  const scoreDeltas = {
    geoOverall:
      geoBefore !== null && geoAfter !== null ? geoAfter - geoBefore : null,
    understanding:
      uBefore !== null && uAfter !== null ? uAfter - uBefore : null,
    simulationAfter:
      simBefore !== null && simAfter !== null ? simAfter - simBefore : null,
  };

  if (scoreDeltas.understanding !== null && scoreDeltas.understanding > 0) {
    highlights.push(
      `AI Understanding ${uBefore}% → ${uAfter}% (+${scoreDeltas.understanding})`
    );
  } else if (
    scoreDeltas.understanding !== null &&
    scoreDeltas.understanding < 0
  ) {
    highlights.push(
      `AI Understanding ${uBefore}% → ${uAfter}% (${scoreDeltas.understanding})`
    );
  }

  if (scoreDeltas.geoOverall !== null && scoreDeltas.geoOverall !== 0) {
    highlights.push(
      `GEO Score ${geoBefore} → ${geoAfter} (${scoreDeltas.geoOverall >= 0 ? "+" : ""}${scoreDeltas.geoOverall})`
    );
  }

  const beforeComponents = new Map(
    (baseline.geoScore?.components ?? []).map((c) => [c.name, c.score])
  );
  const geoComponentDeltas = (current.geoScore?.components ?? [])
    .filter((c) => beforeComponents.has(c.name))
    .map((c) => {
      const before = beforeComponents.get(c.name)!;
      return {
        name: c.name,
        before,
        after: c.score,
        delta: c.score - before,
      };
    })
    .filter((c) => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const baselineGapQs = new Set(
    baseline.contentGaps.map((g) => norm(g.question))
  );
  const currentGapQs = new Set(
    current.contentGaps.map((g) => norm(g.question))
  );
  const resolvedGapQuestions = baseline.contentGaps
    .filter((g) => !currentGapQs.has(norm(g.question)))
    .map((g) => g.question);
  const newGaps = current.contentGaps.filter(
    (g) => !baselineGapQs.has(norm(g.question))
  );

  if (resolvedGapQuestions.length > 0) {
    highlights.push(
      `${resolvedGapQuestions.length} content gap${resolvedGapQuestions.length === 1 ? "" : "s"} no longer flagged`
    );
  }

  const baselineRecTitles = new Set(
    baseline.recommendations.map((r) => norm(r.title))
  );
  const newRecommendations = current.recommendations.filter(
    (r) => !baselineRecTitles.has(norm(r.title))
  );

  const beforePages = new Map(baseline.pages.map((p) => [p.url, p.wordCount]));
  const afterPages = new Map(current.pages.map((p) => [p.url, p.wordCount]));
  const added: string[] = [];
  const removed: string[] = [];
  const wordCountChanges: ScanComparison["pageChanges"]["wordCountChanges"] =
    [];

  for (const [url, wc] of afterPages) {
    if (!beforePages.has(url)) added.push(url);
    else {
      const before = beforePages.get(url)!;
      const delta = wc - before;
      if (Math.abs(delta) >= 50) {
        wordCountChanges.push({ url, before, after: wc, delta });
      }
    }
  }
  for (const url of beforePages.keys()) {
    if (!afterPages.has(url)) removed.push(url);
  }

  if (added.length > 0) {
    highlights.push(`${added.length} new page${added.length === 1 ? "" : "s"} crawled`);
  }

  return {
    baselineScanId: baseline.scanId,
    baselineFinishedAt: baseline.finishedAt,
    currentScanId: current.scanId,
    scoreDeltas,
    geoComponentDeltas,
    resolvedGapQuestions,
    newGaps,
    newRecommendations,
    pageChanges: { added, removed, wordCountChanges },
    highlights,
  };
}

export function snapshotFromDb(input: {
  scanId: string;
  finishedAt: Date | null;
  pages: { url: string; wordCount: number }[];
  analysis: {
    understanding: unknown;
    geoScore: unknown;
    contentGaps: unknown;
    recommendations: unknown;
  } | null;
  simulationResults: unknown | null;
}): ScanSnapshot {
  return {
    scanId: input.scanId,
    finishedAt: input.finishedAt?.toISOString() ?? null,
    pages: input.pages,
    understanding: (input.analysis?.understanding as Understanding) ?? null,
    geoScore: (input.analysis?.geoScore as GeoScore) ?? null,
    contentGaps: (input.analysis?.contentGaps as ContentGap[]) ?? [],
    recommendations: (input.analysis?.recommendations as Recommendation[]) ?? [],
    simulation: (input.simulationResults as SimulationResults) ?? null,
  };
}

/** Count FAQs added between crawls (from stored page extractions). */
export function countFaqDelta(
  beforePages: { extracted: unknown }[],
  afterPages: { extracted: unknown }[]
): number {
  const faqCount = (pages: { extracted: unknown }[]) =>
    pages.reduce((sum, p) => {
      const ext = p.extracted as PageExtraction;
      return sum + (ext.faqs?.length ?? 0);
    }, 0);
  return faqCount(afterPages) - faqCount(beforePages);
}
