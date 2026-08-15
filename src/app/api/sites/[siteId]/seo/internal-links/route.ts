import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";

/** Internal link suggestions for the site, best first. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const rows = await prisma.seoLinkSuggestion.findMany({
    where: { siteId },
    orderBy: { relevance: "desc" },
  });

  return NextResponse.json({
    suggestions: rows.map((r) => ({
      id: r.id,
      fromUrl: r.fromUrl,
      toUrl: r.toUrl,
      anchor: r.anchor,
      relevance: r.relevance,
      reason: r.reason,
      status: r.status,
    })),
  });
}
