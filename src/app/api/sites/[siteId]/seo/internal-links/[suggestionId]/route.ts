import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { SEO_OPPORTUNITY_STATUSES } from "@/lib/seo/types";

/** Approve/dismiss an internal link suggestion. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; suggestionId: string }> }
) {
  const { siteId, suggestionId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const status = body?.status as string | undefined;
  if (!status || !SEO_OPPORTUNITY_STATUSES.includes(status as never)) {
    return NextResponse.json(
      { error: `status must be one of: ${SEO_OPPORTUNITY_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await prisma.seoLinkSuggestion.findUnique({
    where: { id: suggestionId },
  });
  if (!existing || existing.siteId !== siteId) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }

  const updated = await prisma.seoLinkSuggestion.update({
    where: { id: suggestionId },
    data: { status: status as never },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
