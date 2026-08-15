import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { SEO_OPPORTUNITY_STATUSES } from "@/lib/seo/types";

/** Update an opportunity's workflow status (approval workflow). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; oppId: string }> }
) {
  const { siteId, oppId } = await params;
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

  const existing = await prisma.seoOpportunity.findUnique({ where: { id: oppId } });
  if (!existing || existing.siteId !== siteId) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }

  const updated = await prisma.seoOpportunity.update({
    where: { id: oppId },
    data: { status: status as never },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
