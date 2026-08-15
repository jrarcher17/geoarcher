import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import type { SeoIssue, SeoPageFacts } from "@/lib/seo/types";

/** Page-level audits from the site's latest SEO audit. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const audit = await prisma.seoAudit.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });
  if (!audit) {
    return NextResponse.json({ auditId: null, pages: [] });
  }

  const rows = await prisma.seoPageAudit.findMany({
    where: { auditId: audit.id },
    orderBy: { score: "asc" },
  });

  return NextResponse.json({
    auditId: audit.id,
    auditCreatedAt: audit.createdAt.toISOString(),
    pages: rows.map((r) => ({
      id: r.id,
      url: r.url,
      score: r.score,
      issues: r.issues as unknown as SeoIssue[],
      facts: r.facts as unknown as SeoPageFacts,
    })),
  });
}
