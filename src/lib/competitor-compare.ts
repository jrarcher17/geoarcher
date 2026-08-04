import type { GeoScore, SemanticMap, Understanding, VisibilityResults } from "./types";

export interface CompetitorSummary {
  scanId: string;
  siteUrl: string;
  status: string;
  pagesCrawled: number;
  geoOverall: number | null;
  understanding: number | null;
  visibilityOverall: number | null;
  topic: string | null;
  subtopics: string[];
}

export interface CompetitorComparisonResult {
  primary: CompetitorSummary;
  competitors: CompetitorSummary[];
  conceptsCompetitorsCoverMore: string[];
}

function normTopic(s: string): string {
  return s.trim().toLowerCase();
}

function topicMatches(a: string, b: string): boolean {
  const na = normTopic(a);
  const nb = normTopic(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function rowFromScan(input: {
  id: string;
  status: string;
  pagesCrawled: number;
  siteUrl: string;
  analysis: {
    semanticMap: unknown;
    understanding: unknown;
    geoScore: unknown;
  } | null;
  visibilityResults: unknown | null;
}): CompetitorSummary {
  const semantic = input.analysis?.semanticMap as SemanticMap | undefined;
  const understanding = input.analysis?.understanding as Understanding | undefined;
  const geo = input.analysis?.geoScore as GeoScore | undefined;
  const vis = input.visibilityResults as VisibilityResults | null;

  return {
    scanId: input.id,
    siteUrl: input.siteUrl,
    status: input.status,
    pagesCrawled: input.pagesCrawled,
    geoOverall: geo?.overall ?? null,
    understanding: understanding?.confidence ?? null,
    visibilityOverall: vis?.overall ?? null,
    topic: semantic?.topic ?? null,
    subtopics: semantic?.subtopics ?? [],
  };
}

export function buildCompetitorComparison(
  primary: CompetitorSummary,
  competitors: CompetitorSummary[]
): CompetitorComparisonResult {
  const yours = new Set(primary.subtopics.map(normTopic));
  const competitorTopics: string[] = [];

  for (const c of competitors) {
    if (c.status !== "COMPLETE") continue;
    for (const sub of c.subtopics) {
      const covered = [...yours].some((y) => topicMatches(y, sub));
      if (!covered) {
        if (!competitorTopics.some((t) => topicMatches(t, sub))) {
          competitorTopics.push(sub);
        }
      }
    }
  }

  return {
    primary,
    competitors,
    conceptsCompetitorsCoverMore: competitorTopics.slice(0, 15),
  };
}

export { rowFromScan };
