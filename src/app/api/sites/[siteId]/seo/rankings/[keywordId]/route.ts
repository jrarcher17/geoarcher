import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";

/** Stop tracking a keyword (removes its history). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; keywordId: string }> }
) {
  const { siteId, keywordId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const keyword = await prisma.seoKeyword.findUnique({ where: { id: keywordId } });
  if (!keyword || keyword.siteId !== siteId) {
    return NextResponse.json({ error: "Keyword not found." }, { status: 404 });
  }

  await prisma.seoKeyword.delete({ where: { id: keywordId } });
  return NextResponse.json({ ok: true, deleted: keywordId });
}
