import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";

/** Search/keyword opportunities for the site, best first. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const rows = await prisma.seoSearchOpportunity.findMany({
    where: { siteId },
    orderBy: { opportunityScore: "desc" },
  });

  return NextResponse.json({
    opportunities: rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      intent: r.intent,
      demand: r.demand,
      competition: r.competition,
      existingUrl: r.existingUrl,
      recommendedUrl: r.recommendedUrl,
      contentType: r.contentType,
      opportunityScore: r.opportunityScore,
      reason: r.reason,
      status: r.status,
    })),
  });
}
