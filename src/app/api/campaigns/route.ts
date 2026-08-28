import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import type { Prisma } from "@/generated/prisma/client";

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
