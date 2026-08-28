import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import type { Prisma } from "@/generated/prisma/client";

type Status =
  | "DRAFT"
  | "READY"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ERROR";

/** Lifecycle moves the user can make directly (publishing is a separate flow). */
const ALLOWED_TRANSITIONS: Partial<Record<Status, Status[]>> = {
  DRAFT: ["READY"],
  READY: ["DRAFT"],
  ACTIVE: ["PAUSED"],
  PAUSED: ["ACTIVE"],
  ERROR: ["DRAFT"],
};

async function loadOwnCampaign(campaignId: string, userId: string) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    include: {
      site: { select: { id: true, url: true, intelligence: { select: { business: true } } } },
      offering: { select: { id: true, name: true, kind: true } },
      ads: true,
      metrics: {
        select: {
          spendCents: true,
          impressions: true,
          clicks: true,
          conversions: true,
          revenueCents: true,
        },
      },
    },
  });
  if (!campaign || campaign.userId !== userId) return null;
  return campaign;
}

function serialize(campaign: NonNullable<Awaited<ReturnType<typeof loadOwnCampaign>>>) {
  const sum = campaign.metrics.reduce(
    (acc, m) => ({
      spendCents: acc.spendCents + m.spendCents,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      revenueCents: acc.revenueCents + m.revenueCents,
    }),
    { spendCents: 0, impressions: 0, clicks: 0, conversions: 0, revenueCents: 0 }
  );
  const business = campaign.site?.intelligence?.business as { companyName?: string } | null;

  return {
    id: campaign.id,
    name: campaign.name,
    platform: campaign.platform,
    status: campaign.status,
    goal: campaign.goal,
    landingPage: campaign.landingPage,
    budgetDailyCents: campaign.budgetDailyCents,
    currency: campaign.currency,
    locations: campaign.locations,
    audience: campaign.audience,
    structure: campaign.structure,
    error: campaign.error,
    createdAt: campaign.createdAt.toISOString(),
    publishedAt: campaign.publishedAt?.toISOString() ?? null,
    site: campaign.site ? { id: campaign.site.id, url: campaign.site.url } : null,
    businessName: business?.companyName ?? null,
    offering: campaign.offering,
    ads: campaign.ads.map((ad) => ({
      id: ad.id,
      name: ad.name,
      copy: ad.copy,
      destinationUrl: ad.destinationUrl,
      creativeSource: ad.creativeSource,
      creative: ad.creative,
    })),
    metrics: {
      ...sum,
      ctr: sum.impressions > 0 ? sum.clicks / sum.impressions : null,
      cpcCents: sum.clicks > 0 ? Math.round(sum.spendCents / sum.clicks) : null,
      cpaCents:
        sum.conversions > 0 ? Math.round(sum.spendCents / sum.conversions) : null,
      roas: sum.spendCents > 0 ? sum.revenueCents / sum.spendCents : null,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const campaign = await loadOwnCampaign(campaignId, access.userId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  return NextResponse.json({ campaign: serialize(campaign) });
}

/** Rename, adjust budget, or move the campaign through its lifecycle. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const campaign = await loadOwnCampaign(campaignId, access.userId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const data: Prisma.AdCampaignUpdateInput = {};

  if (typeof body?.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body?.budgetDailyCents === "number" && body.budgetDailyCents > 0) {
    data.budgetDailyCents = Math.round(body.budgetDailyCents);
  }

  const nextStatus = typeof body?.status === "string" ? (body.status as Status) : null;
  if (nextStatus && nextStatus !== campaign.status) {
    const allowed = ALLOWED_TRANSITIONS[campaign.status as Status] ?? [];
    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        { error: `A ${campaign.status.toLowerCase()} campaign can't move to ${nextStatus.toLowerCase()}.` },
        { status: 409 }
      );
    }
    data.status = nextStatus;
    if (campaign.status === "ERROR") data.error = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.adCampaign.update({
    where: { id: campaignId },
    data,
  });

  if (data.status) {
    await prisma.aIAction.create({
      data: {
        userId: access.userId,
        action:
          data.status === "READY" ? "campaign_approved" : "campaign_status_changed",
        platform: campaign.platform,
        campaignId,
        status: "EXECUTED",
        approvedBy: access.userId,
        previousValue: { status: campaign.status },
        newValue: { status: updated.status },
        executedAt: new Date(),
      },
    });
  }

  const fresh = await loadOwnCampaign(campaignId, access.userId);
  return NextResponse.json({ campaign: serialize(fresh!) });
}

/** Delete a campaign that isn't live. Active campaigns must be paused first. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { userId: true, status: true, platform: true, name: true },
  });
  if (!campaign || campaign.userId !== access.userId) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  if (campaign.status === "ACTIVE") {
    return NextResponse.json(
      { error: "Pause the campaign before deleting it." },
      { status: 409 }
    );
  }

  await prisma.adCampaign.delete({ where: { id: campaignId } });
  await prisma.aIAction.create({
    data: {
      userId: access.userId,
      action: "campaign_deleted",
      platform: campaign.platform,
      campaignId,
      status: "EXECUTED",
      approvedBy: access.userId,
      previousValue: { name: campaign.name, status: campaign.status },
      executedAt: new Date(),
    },
  });

  return NextResponse.json({ deleted: true });
}
