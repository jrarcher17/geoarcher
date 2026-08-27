import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLeadGenAccess } from "@/lib/leads/api-guard";
import { sendOutreach } from "@/lib/leads/pipeline";

/** Bulk-approve and send draft outreach for a campaign. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  const campaign = await prisma.leadCampaign.findFirst({
    where: { id, userId: access.userId },
    select: { id: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const requested = Array.isArray(body?.prospectIds)
    ? body.prospectIds.filter((v: unknown) => typeof v === "string")
    : null;

  const drafts = await prisma.prospect.findMany({
    where: {
      campaignId: id,
      status: "QUALIFIED",
      ...(requested ? { id: { in: requested } } : {}),
      emails: { some: { followUpIndex: 0, status: { in: ["DRAFT", "QUEUED"] } } },
    },
    select: { id: true },
  });

  const results: { id: string; outcome: string }[] = [];
  for (const prospect of drafts) {
    try {
      const outcome = await sendOutreach(prospect.id);
      results.push({ id: prospect.id, outcome });
    } catch (err) {
      results.push({
        id: prospect.id,
        outcome: err instanceof Error ? err.message : "send failed",
      });
    }
  }

  return NextResponse.json({ sent: results.filter((r) => r.outcome === "sent").length, results });
}
