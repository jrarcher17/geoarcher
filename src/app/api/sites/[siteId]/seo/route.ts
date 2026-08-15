import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { latestAuditableScan } from "@/lib/seo/audit-runner";
import type {
  SeoAuditSummaryDto,
  SeoCategoryScore,
  SeoContentPlanEntry,
  SeoIssueTotals,
  SeoOpportunityDto,
  SeoSiteCheck,
} from "@/lib/seo/types";
import type { GeoScore } from "@/lib/types";

/** SEO Autopilot overview: latest audit, opportunities, and GEO bridge. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const latestScan = await latestAuditableScan(siteId);

  const auditRow = await prisma.seoAudit.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    include: { scan: { select: { pagesCrawled: true } } },
  });

  let audit: SeoAuditSummaryDto | null = null;
  if (auditRow) {
    const categoryData = auditRow.categoryScores as {
      categories?: SeoCategoryScore[];
      totals?: SeoIssueTotals;
    } | null;
    audit = {
      id: auditRow.id,
      scanId: auditRow.scanId,
      status: auditRow.status,
      error: auditRow.error,
      createdAt: auditRow.createdAt.toISOString(),
      finishedAt: auditRow.finishedAt?.toISOString() ?? null,
      overallScore: auditRow.overallScore,
      categories: categoryData?.categories ?? [],
      siteChecks: (auditRow.siteChecks as unknown as SeoSiteCheck[]) ?? [],
      totals: categoryData?.totals ?? null,
      pagesCrawled: auditRow.scan.pagesCrawled,
    };
  }

  const opportunityRows = await prisma.seoOpportunity.findMany({
    where: { siteId },
    orderBy: { opportunityScore: "desc" },
  });
  const opportunities: SeoOpportunityDto[] = opportunityRows.map((o) => ({
    id: o.id,
    category: o.category as SeoOpportunityDto["category"],
    title: o.title,
    description: o.description,
    observed: o.observed,
    inferred: o.inferred,
    impact: o.impact as SeoOpportunityDto["impact"],
    difficulty: o.difficulty as SeoOpportunityDto["difficulty"],
    opportunityScore: o.opportunityScore,
    contentType: o.contentType,
    affectedPages: (o.affectedPages as string[]) ?? [],
    source: o.source as SeoOpportunityDto["source"],
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

  // GEO bridge for the unified visibility view — reuse the existing analysis.
  let geoOverall: number | null = null;
  let geoComponents: { name: string; score: number }[] = [];
  if (latestScan) {
    const analysis = await prisma.analysis.findUnique({
      where: { scanId: latestScan.id },
      select: { geoScore: true },
    });
    if (analysis) {
      const geo = analysis.geoScore as unknown as GeoScore;
      geoOverall = geo.overall ?? null;
      geoComponents = (geo.components ?? []).map((c) => ({
        name: c.name,
        score: c.score,
      }));
    }
  }

  const historyRows = await prisma.seoAudit.findMany({
    where: { siteId, status: "COMPLETE", overallScore: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, overallScore: true },
    take: 48,
  });

  return NextResponse.json({
    siteId,
    siteUrl: site.url,
    plan: "pro",
    latestScanId: latestScan?.id ?? null,
    audit,
    opportunities,
    contentPlan: (auditRow?.contentPlan as unknown as SeoContentPlanEntry[]) ?? [],
    geoOverall,
    geoComponents,
    history: historyRows.map((h) => ({
      date: h.createdAt.toISOString(),
      overall: h.overallScore as number,
    })),
  });
}
