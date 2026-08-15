import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import type { SeoIssue, SeoPageFacts } from "@/lib/seo/types";
import type { GeoScore, PageExtraction } from "@/lib/types";

/** One page audit, plus the stored crawl extraction and GEO bridge data. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; pageAuditId: string }> }
) {
  const { siteId, pageAuditId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const row = await prisma.seoPageAudit.findUnique({
    where: { id: pageAuditId },
    include: { audit: { select: { siteId: true, scanId: true } } },
  });
  if (!row || row.audit.siteId !== siteId) {
    return NextResponse.json({ error: "Page audit not found." }, { status: 404 });
  }

  // Pull the page's stored extraction for content context (no recrawl).
  let extraction: PageExtraction | null = null;
  if (row.pageId) {
    const page = await prisma.page.findUnique({
      where: { id: row.pageId },
      select: { extracted: true },
    });
    if (page) extraction = page.extracted as unknown as PageExtraction;
  }

  // Site-level GEO analysis from the same scan (GEO scoring is site-level).
  const analysis = await prisma.analysis.findUnique({
    where: { scanId: row.audit.scanId },
    select: { geoScore: true },
  });
  const geoScore = analysis ? (analysis.geoScore as unknown as GeoScore) : null;

  return NextResponse.json({
    id: row.id,
    url: row.url,
    score: row.score,
    issues: row.issues as unknown as SeoIssue[],
    facts: row.facts as unknown as SeoPageFacts,
    content: extraction
      ? {
          headings: extraction.headings,
          faqs: extraction.faqs.slice(0, 10),
          jsonLdTypes: extraction.jsonLdTypes,
          mainContentPreview: extraction.mainContent.slice(0, 1200),
        }
      : null,
    geo: geoScore
      ? { overall: geoScore.overall, components: geoScore.components }
      : null,
  });
}
