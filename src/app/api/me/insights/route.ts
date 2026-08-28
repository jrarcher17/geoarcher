import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { planFromDb } from "@/lib/plans";
import { getServerSession } from "@/lib/session";
import { bucketSeoCategory } from "@/lib/opportunity-buckets";
import type {
  ContentGap,
  GeoScore,
  Recommendation,
  SimulationResults,
  Understanding,
  VisibilityResults,
} from "@/lib/types";

export interface SiteInsight {
  siteId: string;
  url: string;
  addedAt: string;
  latestScan: {
    id: string;
    status: string;
    createdAt: string;
    finishedAt: string | null;
    pagesCrawled: number;
  } | null;
  analysis: {
    geoOverall: number;
    understanding: number;
    businessSummary: string;
    topic: string;
    subtopics: string[];
    problems: { issue: string; detail: string }[];
    contentGaps: ContentGap[];
    recommendations: Recommendation[];
    components: { name: string; score: number }[];
  } | null;
  visibility: VisibilityResults | null;
  simulation: SimulationResults | null;
  seoOverall: number | null;
  autopilotEnabled: boolean;
  layerEnabled: boolean;
  openOpportunities: number;
  completedOpportunities: number;
  opportunityBuckets: { label: string; count: number }[];
  history: { date: string; geo: number | null; understanding: number | null }[];
}

/** One aggregate read powering Dashboard, Visibility, Recommendations,
 *  Opportunities, and Reports. */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const plan = planFromDb(
    (
      await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true },
      })
    )?.plan
  );

  const links = await prisma.userSite.findMany({
    where: { userId: session.user.id },
    include: {
      site: {
        include: {
          scans: {
            where: { benchmarkScanId: null },
            orderBy: { createdAt: "desc" },
            take: 12,
            include: { analysis: true, visibility: true, simulation: true },
          },
          geoConfig: { select: { enabled: true } },
          seoAudits: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { overallScore: true },
          },
          seoOpportunities: {
            select: { category: true, status: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const sites: SiteInsight[] = links.map((link) => {
    const scans = link.site.scans;
    const latest = scans[0] ?? null;
    const latestComplete = scans.find(
      (s) => s.status === "COMPLETE" && s.analysis
    );
    const analysisRow = latestComplete?.analysis ?? null;

    const understanding = analysisRow?.understanding as Understanding | undefined;
    const geo = analysisRow?.geoScore as GeoScore | undefined;
    const semanticMap = analysisRow?.semanticMap as
      | { topic: string; subtopics: string[] }
      | undefined;

    const visibilityRow = latestComplete?.visibility;
    const visibility =
      visibilityRow?.status === "COMPLETE"
        ? ((visibilityRow.results as unknown as VisibilityResults) ?? null)
        : null;
    const simulationRow = latestComplete?.simulation;
    const simulation =
      simulationRow?.status === "COMPLETE"
        ? ((simulationRow.results as unknown as SimulationResults) ?? null)
        : null;

    const recs =
      (analysisRow?.recommendations as unknown as Recommendation[]) ?? [];
    const gaps =
      (analysisRow?.contentGaps as unknown as ContentGap[]) ?? [];
    const bucketCounts = new Map<string, number>();
    let openOpportunities = recs.length + gaps.length;
    let completedOpportunities = 0;
    for (const opp of link.site.seoOpportunities) {
      if (opp.status === "DISMISSED") continue;
      if (opp.status === "COMPLETED") completedOpportunities += 1;
      else openOpportunities += 1;
      const bucket = bucketSeoCategory(opp.category);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
    }
    for (const rec of recs) {
      const bucket = bucketSeoCategory(rec.category || "GEO");
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
    }
    if (gaps.length > 0) {
      bucketCounts.set(
        "Content",
        (bucketCounts.get("Content") ?? 0) + gaps.length
      );
    }

    const history = [...scans]
      .filter((s) => s.status === "COMPLETE" && s.analysis)
      .reverse()
      .map((s) => {
        const g = s.analysis?.geoScore as GeoScore | undefined;
        const u = s.analysis?.understanding as Understanding | undefined;
        return {
          date: (s.finishedAt ?? s.createdAt).toISOString(),
          geo: g?.overall ?? null,
          understanding: u?.confidence ?? null,
        };
      });

    return {
      siteId: link.site.id,
      url: link.site.url,
      addedAt: link.createdAt.toISOString(),
      latestScan: latest
        ? {
            id: latest.id,
            status: latest.status,
            createdAt: latest.createdAt.toISOString(),
            finishedAt: latest.finishedAt?.toISOString() ?? null,
            pagesCrawled: latest.pagesCrawled,
          }
        : null,
      analysis:
        analysisRow && understanding && geo
          ? {
              geoOverall: geo.overall,
              understanding: understanding.confidence,
              businessSummary: understanding.businessSummary,
              topic: semanticMap?.topic ?? "",
              subtopics: semanticMap?.subtopics ?? [],
              problems: understanding.problems,
              contentGaps: (analysisRow.contentGaps as unknown as ContentGap[]) ?? [],
              recommendations:
                (analysisRow.recommendations as unknown as Recommendation[]) ?? [],
              components: geo.components.map((c) => ({
                name: c.name,
                score: c.score,
              })),
            }
          : null,
      visibility,
      simulation,
      seoOverall: link.site.seoAudits[0]?.overallScore ?? null,
      autopilotEnabled: link.site.autopilotEnabled,
      layerEnabled: Boolean(link.site.geoConfig?.enabled),
      openOpportunities,
      completedOpportunities,
      opportunityBuckets: [...bucketCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      history,
    };
  });

  // The scan the generate/recommendation CTAs should target per site
  const scanIds: Record<string, string | null> = {};
  for (const link of links) {
    const complete = link.site.scans.find(
      (s) => s.status === "COMPLETE" && s.analysis
    );
    scanIds[link.site.id] = complete?.id ?? null;
  }

  return NextResponse.json({ sites, scanIds, plan });
}
