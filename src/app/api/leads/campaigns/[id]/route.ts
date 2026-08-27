import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startLeadGenCampaign } from "@/lib/jobs/start";
import { requireLeadGenAccess } from "@/lib/leads/api-guard";
import { serializeCampaign, serializeProspect } from "@/lib/leads/serialize";
import { kickLeadCampaignWork } from "@/lib/leads/campaign-runner";
import { isUnreachableProspect } from "@/lib/leads/site-live";
import {
  countLiveProspects,
  prepareMissingOutreach,
} from "@/lib/leads/pipeline";

export const maxDuration = 300;

async function loadOwnedCampaign(userId: string, id: string) {
  return prisma.leadCampaign.findFirst({
    where: { id, userId },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  let campaign = await loadOwnedCampaign(access.userId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const prospects = await prisma.prospect.findMany({
    where: { campaignId: id },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    include: {
      emails: { orderBy: { followUpIndex: "asc" } },
    },
  });

  const visible = prospects.filter((p) => !isUnreachableProspect(p));
  const live = await countLiveProspects(id);
  const underTarget = live < campaign.targetCount;
  if (
    Date.now() - campaign.createdAt.getTime() > 10_000 &&
    (campaign.status === "RUNNING" || (campaign.status === "COMPLETE" && underTarget))
  ) {
    if (campaign.status === "COMPLETE" && underTarget) {
      campaign = await prisma.leadCampaign.update({
        where: { id },
        data: { status: "RUNNING", error: null },
      });
    }
    if (campaign.status === "RUNNING") {
      after(() => kickLeadCampaignWork(id, 0));
    }
  }

  if (visible.some((p) => p.status === "QUALIFIED" && !p.contactEmail)) {
    after(() =>
      prepareMissingOutreach(id).catch((err) =>
        console.error("[leads] prepare missing outreach failed:", err)
      )
    );
  }

  return NextResponse.json({
    campaign: serializeCampaign(campaign),
    prospects: visible.map(serializeProspect),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  const campaign = await loadOwnedCampaign(access.userId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "pause" && action !== "resume" && action !== "cancel") {
    return NextResponse.json(
      { error: "Provide action: pause, resume, or cancel." },
      { status: 400 }
    );
  }

  if (action === "cancel") {
    const updated = await prisma.leadCampaign.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json(serializeCampaign(updated));
  }

  if (action === "pause") {
    if (campaign.status !== "RUNNING") {
      return NextResponse.json(
        { error: "Only a running campaign can be paused." },
        { status: 400 }
      );
    }
    const updated = await prisma.leadCampaign.update({
      where: { id },
      data: { status: "PAUSED" },
    });
    return NextResponse.json(serializeCampaign(updated));
  }

  if (campaign.status !== "PAUSED") {
    return NextResponse.json(
      { error: "Only a paused campaign can be resumed." },
      { status: 400 }
    );
  }
  const updated = await prisma.leadCampaign.update({
    where: { id },
    data: { status: "RUNNING", error: null },
  });
  await startLeadGenCampaign(id);
  return NextResponse.json(serializeCampaign(updated));
}
