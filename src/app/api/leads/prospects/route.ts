import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLeadGenAccess } from "@/lib/leads/api-guard";
import { serializeProspect } from "@/lib/leads/serialize";
import { isUnreachableProspect } from "@/lib/leads/site-live";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const prospects = await prisma.prospect.findMany({
    where: { campaign: { userId: access.userId } },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    include: {
      campaign: { select: { id: true, name: true } },
      emails: { orderBy: { followUpIndex: "asc" } },
    },
    take: 200,
  });

  return NextResponse.json({
    prospects: prospects
      .filter((p) => !isUnreachableProspect(p))
      .map((p) => ({
        ...serializeProspect(p),
        campaignName: p.campaign.name,
      })),
  });
}
