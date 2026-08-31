import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { hasRealPerformance } from "@/lib/advertising/ad-preview";
import { syncPlatformStatus } from "@/lib/advertising/publish";
import { Prisma } from "@/generated/prisma/client";

type Status =
  | "DRAFT"
  | "READY"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED"
  | "ERROR";

/** Lifecycle moves the user can make directly (publishing is a separate flow). */
const ALLOWED_TRANSITIONS: Partial<Record<Status, Status[]>> = {
  DRAFT: ["READY", "ARCHIVED"],
  READY: ["DRAFT", "ARCHIVED"],
  ACTIVE: ["PAUSED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ERROR: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
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

function connectionLabel(platform: string): string {
  if (platform === "GOOGLE") return "Google Ads";
  if (platform === "META") return "Meta";
  return "ChatGPT Ads";
}

async function connectionInfo(userId: string, platform: string) {
  if (platform !== "GOOGLE" && platform !== "META" && platform !== "AI_CHAT") {
    return {
      connected: false,
      accountName: null as string | null,
      canPublish: false,
      blockedReason: "This platform cannot be published from GEO Archer.",
    };
  }
  const row = await prisma.adPlatformConnection.findUnique({
    where: { userId_platform: { userId, platform } },
    select: { status: true, accountId: true, accountName: true },
  });
  if (row?.status !== "CONNECTED") {
    return {
      connected: false,
      accountName: null,
      canPublish: false,
      blockedReason: `Connect ${connectionLabel(platform)} in Integrations to publish.`,
    };
  }
  if (!row.accountId) {
    return {
      connected: true,
      accountName: row.accountName,
      canPublish: false,
      blockedReason: "Select an ad account in Integrations first.",
    };
  }
  return {
    connected: true,
    accountName: row.accountName,
    canPublish: true,
    blockedReason: null as string | null,
  };
}

function serialize(
  campaign: NonNullable<Awaited<ReturnType<typeof loadOwnCampaign>>>,
  siblings: { id: string; platform: string; status: string }[]
) {
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
  const live = hasRealPerformance(sum);

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
    familyId: campaign.familyId,
    error: campaign.error,
    createdAt: campaign.createdAt.toISOString(),
    publishedAt: campaign.publishedAt?.toISOString() ?? null,
    site: campaign.site ? { id: campaign.site.id, url: campaign.site.url } : null,
    businessName: business?.companyName ?? null,
    offering: campaign.offering,
    siblings,
    ads: campaign.ads.map((ad) => ({
      id: ad.id,
      name: ad.name,
      copy: ad.copy,
      destinationUrl: ad.destinationUrl,
      creativeSource: ad.creativeSource,
      creative: ad.creative,
    })),
    hasPerformance: live,
    metrics: live
      ? {
          ...sum,
          ctr: sum.impressions > 0 ? sum.clicks / sum.impressions : null,
          cpcCents: sum.clicks > 0 ? Math.round(sum.spendCents / sum.clicks) : null,
          cpaCents:
            sum.conversions > 0 ? Math.round(sum.spendCents / sum.conversions) : null,
          roas: sum.spendCents > 0 ? sum.revenueCents / sum.spendCents : null,
        }
      : {
          spendCents: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenueCents: 0,
          ctr: null,
          cpcCents: null,
          cpaCents: null,
          roas: null,
        },
  };
}

async function loadSiblings(
  userId: string,
  campaign: { id: string; familyId: string | null; platform: string; status: string }
) {
  if (!campaign.familyId) {
    return [{ id: campaign.id, platform: campaign.platform, status: campaign.status }];
  }
  return prisma.adCampaign.findMany({
    where: { userId, familyId: campaign.familyId },
    select: { id: true, platform: true, status: true },
    orderBy: { createdAt: "asc" },
  });
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
  return NextResponse.json({
    campaign: serialize(
      campaign,
      await loadSiblings(access.userId, campaign)
    ),
    connection: await connectionInfo(access.userId, campaign.platform),
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
}

/** Rename, adjust budget, creative, copy, or move the campaign through its lifecycle. */
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
  const ad = campaign.ads[0];
  const adData: Prisma.AdUpdateInput = {};

  if (typeof body?.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body?.budgetDailyCents === "number" && body.budgetDailyCents > 0) {
    data.budgetDailyCents = Math.round(body.budgetDailyCents);
  }
  if (typeof body?.landingPage === "string") {
    const landing = body.landingPage.trim();
    data.landingPage = landing || null;
    if (ad) adData.destinationUrl = landing || null;
  }

  if (body && "creative" in body && ad) {
    if (body.creative === null) {
      adData.creative = Prisma.DbNull;
      adData.creativeSource = "NONE";
    } else if (body.creative && typeof body.creative === "object") {
      const creative = body.creative as Record<string, unknown>;
      const url = typeof creative.url === "string" ? creative.url.trim() : "";
      if (!url) {
        return NextResponse.json(
          { error: "Creative needs an image URL, or send null to remove it." },
          { status: 400 }
        );
      }
      const source =
        creative.source === "GENERATED" ||
        creative.source === "UPLOAD" ||
        creative.source === "SITE_IMAGE"
          ? creative.source
          : "SITE_IMAGE";
      adData.creative = {
        url,
        alt: typeof creative.alt === "string" ? creative.alt : null,
        siteImageId:
          typeof creative.siteImageId === "string" ? creative.siteImageId : null,
        source,
      };
      adData.creativeSource = source;
    }
  }

  if (body?.copy && typeof body.copy === "object" && ad) {
    const incoming = body.copy as Record<string, unknown>;
    const next = asRecord(ad.copy);
    if (typeof incoming.primaryText === "string") next.primaryText = incoming.primaryText;
    if (typeof incoming.advertiser === "string") next.advertiser = incoming.advertiser;
    if (typeof incoming.headline === "string") {
      next.headline = incoming.headline;
      if (campaign.platform === "META") next.headlines = [incoming.headline];
    }
    if (typeof incoming.description === "string") {
      next.description = incoming.description;
      if (campaign.platform === "META") next.descriptions = [incoming.description];
    }
    const headlines = strings(incoming.headlines);
    if (headlines) next.headlines = headlines;
    const descriptions = strings(incoming.descriptions);
    if (descriptions) next.descriptions = descriptions;
    const intents = strings(incoming.intents);
    if (intents) next.intents = intents;
    if (typeof incoming.prompt === "string") next.prompt = incoming.prompt;
    if (typeof incoming.answer === "string") next.answer = incoming.answer;
    adData.copy = next as Prisma.InputJsonValue;
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
    if (
      campaign.externalId &&
      (nextStatus === "PAUSED" || nextStatus === "ACTIVE")
    ) {
      try {
        await syncPlatformStatus(access.userId, campaignId, nextStatus);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Could not update the live campaign." },
          { status: 502 }
        );
      }
    }
  }

  if (Object.keys(data).length === 0 && Object.keys(adData).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (ad && Object.keys(adData).length > 0) {
      await tx.ad.update({ where: { id: ad.id }, data: adData });
    }
    if (Object.keys(data).length === 0) {
      return campaign;
    }
    return tx.adCampaign.update({
      where: { id: campaignId },
      data,
    });
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
  return NextResponse.json({
    campaign: serialize(fresh!, await loadSiblings(access.userId, fresh!)),
    connection: await connectionInfo(access.userId, campaign.platform),
  });
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
