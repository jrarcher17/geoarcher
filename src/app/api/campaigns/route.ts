import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { userOwnsSite } from "@/lib/user-plan";
import type { Prisma } from "@/generated/prisma/client";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

/** Unified campaign list with lifetime metric aggregates. */
export async function GET(request: NextRequest) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const { searchParams } = request.nextUrl;
  const where: Prisma.AdCampaignWhereInput = { userId: access.userId };
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");
  const siteId = searchParams.get("site");
  if (platform && ["GOOGLE", "META", "AI_CHAT"].includes(platform)) {
    where.platform = platform as "GOOGLE" | "META" | "AI_CHAT";
  }
  if (status) {
    where.status = status as Prisma.AdCampaignWhereInput["status"];
  }
  if (siteId) where.siteId = siteId;

  const campaigns = await prisma.adCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      site: { select: { id: true, url: true } },
      offering: { select: { id: true, name: true } },
      _count: { select: { ads: true } },
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

  return NextResponse.json({
    campaigns: campaigns.map((c) => {
      const sum = c.metrics.reduce(
        (acc, m) => ({
          spendCents: acc.spendCents + m.spendCents,
          impressions: acc.impressions + m.impressions,
          clicks: acc.clicks + m.clicks,
          conversions: acc.conversions + m.conversions,
          revenueCents: acc.revenueCents + m.revenueCents,
        }),
        { spendCents: 0, impressions: 0, clicks: 0, conversions: 0, revenueCents: 0 }
      );
      return {
        id: c.id,
        name: c.name,
        platform: c.platform,
        status: c.status,
        goal: c.goal,
        budgetDailyCents: c.budgetDailyCents,
        site: c.site,
        offering: c.offering,
        ads: c._count.ads,
        createdAt: c.createdAt.toISOString(),
        spendCents: sum.spendCents,
        impressions: sum.impressions,
        clicks: sum.clicks,
        ctr: sum.impressions > 0 ? sum.clicks / sum.impressions : null,
        cpcCents: sum.clicks > 0 ? Math.round(sum.spendCents / sum.clicks) : null,
        conversions: sum.conversions,
        cpaCents:
          sum.conversions > 0 ? Math.round(sum.spendCents / sum.conversions) : null,
        revenueCents: sum.revenueCents,
        roas: sum.spendCents > 0 ? sum.revenueCents / sum.spendCents : null,
      };
    }),
  });
}

const GOALS = ["LEADS", "SALES", "TRAFFIC", "PHONE_CALLS", "AWARENESS"] as const;
type Goal = (typeof GOALS)[number];

interface GooglePayload {
  adGroupName?: string;
  headlines?: string[];
  descriptions?: string[];
  keywords?: string[];
}

interface MetaPayload {
  adSetName?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  cta?: string;
  creative?: { siteImageId?: string; url?: string; alt?: string | null } | null;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

/**
 * Save AI-generated campaigns after user review. Creates one AdCampaign per
 * selected platform (plus one Ad each) with status DRAFT or READY. Nothing is
 * published to an ad platform here.
 */
export async function POST(request: NextRequest) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const siteId = typeof body?.siteId === "string" ? body.siteId : null;
  const offeringId = typeof body?.offeringId === "string" ? body.offeringId : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const goal: Goal | null = GOALS.includes(body?.goal) ? body.goal : null;
  const landingPage =
    typeof body?.landingPage === "string" ? body.landingPage.trim() : "";
  const status = body?.status === "READY" ? "READY" : "DRAFT";
  const platforms = strings(body?.platforms).filter((p) =>
    ["GOOGLE", "META"].includes(p)
  ) as ("GOOGLE" | "META")[];

  if (!siteId || !name || !goal || !landingPage || platforms.length === 0) {
    return NextResponse.json(
      { error: "siteId, name, goal, landingPage and at least one platform are required." },
      { status: 400 }
    );
  }
  if (!(await userOwnsSite(access.userId, siteId))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const budgetDailyCents =
    typeof body?.budgetDailyCents === "number" && body.budgetDailyCents > 0
      ? Math.round(body.budgetDailyCents)
      : null;
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const audience = typeof body?.audience === "string" ? body.audience.trim() : "";
  const google = (body?.google ?? null) as GooglePayload | null;
  const meta = (body?.meta ?? null) as MetaPayload | null;
  const prospectId =
    typeof body?.prospectId === "string" && body.prospectId.trim()
      ? body.prospectId.trim()
      : null;
  if (prospectId) {
    const owned = await prisma.prospect.findFirst({
      where: { id: prospectId, campaign: { userId: access.userId } },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json(
        { error: "That prospect does not belong to you." },
        { status: 400 }
      );
    }
  }

  const base = {
    userId: access.userId,
    siteId,
    offeringId,
    prospectId,
    status,
    goal,
    landingPage,
    budgetDailyCents,
    locations: asJson(location ? [{ name: location, type: "region" }] : []),
    audience: audience ? asJson({ description: audience }) : undefined,
  } as const;

  const created: { id: string; platform: string }[] = [];

  if (platforms.includes("GOOGLE")) {
    const headlines = strings(google?.headlines);
    const descriptions = strings(google?.descriptions);
    const keywords = strings(google?.keywords);
    if (headlines.length === 0 || descriptions.length === 0) {
      return NextResponse.json(
        { error: "Google campaigns need headlines and descriptions." },
        { status: 400 }
      );
    }
    const campaign = await prisma.adCampaign.create({
      data: {
        ...base,
        platform: "GOOGLE",
        name,
        structure: asJson({
          adGroupName: google?.adGroupName ?? name,
          keywords,
        }),
        ads: {
          create: {
            name: google?.adGroupName ?? name,
            destinationUrl: landingPage,
            creativeSource: "NONE",
            copy: asJson({ headlines, descriptions, keywords }),
          },
        },
      },
    });
    created.push({ id: campaign.id, platform: "GOOGLE" });
  }

  if (platforms.includes("META")) {
    if (!meta?.primaryText || !meta?.headline) {
      return NextResponse.json(
        { error: "Meta campaigns need primary text and a headline." },
        { status: 400 }
      );
    }
    const creative = meta.creative?.url
      ? {
          url: meta.creative.url,
          alt: meta.creative.alt ?? null,
          siteImageId: meta.creative.siteImageId ?? null,
        }
      : null;
    const campaign = await prisma.adCampaign.create({
      data: {
        ...base,
        platform: "META",
        name,
        structure: asJson({
          adSetName: meta.adSetName ?? name,
          cta: meta.cta ?? "LEARN_MORE",
        }),
        ads: {
          create: {
            name: meta.adSetName ?? name,
            destinationUrl: landingPage,
            creativeSource: creative ? "SITE_IMAGE" : "NONE",
            creative: creative ? asJson(creative) : undefined,
            copy: asJson({
              primaryText: meta.primaryText,
              headlines: [meta.headline],
              descriptions: meta.description ? [meta.description] : [],
              cta: meta.cta ?? "LEARN_MORE",
            }),
          },
        },
      },
    });
    created.push({ id: campaign.id, platform: "META" });
  }

  // Audit trail: record the user's review decision on AI-generated campaigns.
  await prisma.aIAction.create({
    data: {
      userId: access.userId,
      action: status === "READY" ? "campaign_approved" : "campaign_draft_saved",
      status: "EXECUTED",
      approvedBy: status === "READY" ? access.userId : null,
      newValue: asJson({ name, goal, budgetDailyCents, campaigns: created }),
      executedAt: new Date(),
    },
  });

  return NextResponse.json({ campaigns: created }, { status: 201 });
}
