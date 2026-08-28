import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { parsePayload, queueAction } from "@/lib/advertising/execute-action";

/** Queue a recommendation as a pending action — still requires Approve. */
export async function POST(request: Request) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const payload = parsePayload(body?.payload);
  const title = typeof body?.title === "string" ? body.title : "Proposed change";
  const detail = typeof body?.detail === "string" ? body.detail : "";
  if (!payload) {
    return NextResponse.json({ error: "This recommendation isn’t an executable action." }, { status: 400 });
  }

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: payload.campaignId },
    select: { userId: true, platform: true },
  });
  if (!campaign || campaign.userId !== access.userId) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const action = await queueAction(access.userId, payload, {
    title,
    detail,
    platform: campaign.platform,
  });
  return NextResponse.json({
    action: {
      id: action.id,
      action: action.action,
      campaignId: action.campaignId,
      status: action.status,
      title,
      detail,
    },
  });
}
