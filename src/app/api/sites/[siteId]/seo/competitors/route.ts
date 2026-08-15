import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { latestAuditableScan, runSeoAudit } from "@/lib/seo/audit-runner";
import type {
  SeoCategoryScore,
  SeoCompetitorComparisonDto,
  SeoCompetitorRow,
} from "@/lib/seo/types";

export const maxDuration = 300;

const MAX_COMPETITORS = 5;
const GAP_THRESHOLD = 8;

async function rowForScan(scan: {
  id: string;
  siteId: string;
  status: string;
  pagesCrawled: number;
  siteUrl: string;
}): Promise<SeoCompetitorRow> {
  let audit = await prisma.seoAudit.findUnique({ where: { scanId: scan.id } });

  // Competitor scans get a deterministic-only audit on first view (no AI,
  // no opportunities — we never generate recommendations for other sites).
  if (!audit && scan.status === "COMPLETE" && scan.pagesCrawled > 0) {
    try {
      const auditId = await runSeoAudit(scan.siteId, scan.id, { withAi: false });
      audit = await prisma.seoAudit.findUnique({ where: { id: auditId } });
    } catch (err) {
      console.error("[seo-competitors] audit failed:", err);
    }
  }

  const categoryData = audit?.categoryScores as {
    categories?: SeoCategoryScore[];
  } | null;

  return {
    scanId: scan.id,
    siteUrl: scan.siteUrl,
    status: scan.status as SeoCompetitorRow["status"],
    pagesCrawled: scan.pagesCrawled,
    overallScore: audit?.overallScore ?? null,
    categories: categoryData?.categories ?? [],
  };
}

/** You-vs-competitors SEO comparison, reusing existing competitor scans. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const primary = await latestAuditableScan(siteId);
  if (!primary) {
    return NextResponse.json(
      { error: "No completed scan found. Run a site scan first." },
      { status: 409 }
    );
  }

  const scan = await prisma.scan.findUnique({
    where: { id: primary.id },
    include: {
      site: { select: { url: true } },
      competitorScans: {
        include: { site: { select: { id: true, url: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const you = await rowForScan({
    id: scan.id,
    siteId,
    status: scan.status,
    pagesCrawled: scan.pagesCrawled,
    siteUrl: scan.site.url,
  });

  const competitors: SeoCompetitorRow[] = [];
  for (const c of scan.competitorScans) {
    competitors.push(
      await rowForScan({
        id: c.id,
        siteId: c.site.id,
        status: c.status,
        pagesCrawled: c.pagesCrawled,
        siteUrl: c.site.url,
      })
    );
  }

  // Competitive gaps: categories where a competitor meaningfully outscores you.
  const gaps: SeoCompetitorComparisonDto["gaps"] = [];
  for (const yourCat of you.categories) {
    if (yourCat.id === "contentOpportunities") continue;
    let best: { score: number; url: string } | null = null;
    for (const comp of competitors) {
      const theirs = comp.categories.find((c) => c.id === yourCat.id);
      if (theirs && (!best || theirs.score > best.score)) {
        best = { score: theirs.score, url: comp.siteUrl };
      }
    }
    if (best && best.score - yourCat.score >= GAP_THRESHOLD) {
      gaps.push({
        category: yourCat.label,
        you: yourCat.score,
        competitor: best.score,
        competitorUrl: best.url,
      });
    }
  }
  gaps.sort((a, b) => b.competitor - b.you - (a.competitor - a.you));

  const dto: SeoCompetitorComparisonDto = {
    primaryScanId: scan.id,
    you,
    competitors,
    gaps,
    maxCompetitors: MAX_COMPETITORS,
  };
  return NextResponse.json(dto);
}
