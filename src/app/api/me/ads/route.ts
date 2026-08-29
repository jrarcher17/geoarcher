import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import {
  creativeAlt,
  creativeUrl,
  previewFromCopy,
} from "@/lib/advertising/ad-preview";

/**
 * Individual ads the user owns — copy, creative, campaign context, and
 * real AdMetric totals when they exist. Never invents performance or versions.
 */
export async function GET() {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const ads = await prisma.ad.findMany({
    where: { campaign: { userId: access.userId } },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          platform: true,
          status: true,
          publishedAt: true,
          site: { select: { id: true, url: true } },
          offering: { select: { id: true, name: true } },
        },
      },
      metrics: {
        select: {
          spendCents: true,
          impressions: true,
          clicks: true,
          conversions: true,
        },
      },
    },
  });

  const versions = new Map<string, number>();
  const byCampaign = new Map<string, typeof ads>();
  for (const ad of ads) {
    const list = byCampaign.get(ad.campaignId) ?? [];
    list.push(ad);
    byCampaign.set(ad.campaignId, list);
  }
  for (const [campaignId, list] of byCampaign) {
    const ordered = [...list].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    ordered.forEach((ad, i) => versions.set(`${campaignId}:${ad.id}`, i + 1));
  }

  return NextResponse.json({
    ads: ads.map((ad) => {
      const sum = ad.metrics.reduce(
        (acc, m) => ({
          spendCents: acc.spendCents + m.spendCents,
          impressions: acc.impressions + m.impressions,
          clicks: acc.clicks + m.clicks,
          conversions: acc.conversions + m.conversions,
        }),
        { spendCents: 0, impressions: 0, clicks: 0, conversions: 0 }
      );
      const hasPerformance = sum.impressions > 0 || sum.spendCents > 0;
      const preview = previewFromCopy(ad.copy, ad.campaign.platform);
      return {
        id: ad.id,
        name: ad.name,
        headline: preview.headline,
        body: preview.body,
        creativeUrl: creativeUrl(ad.creative),
        creativeAlt: creativeAlt(ad.creative),
        creativeSource: ad.creativeSource,
        destinationUrl: ad.destinationUrl,
        version: versions.get(`${ad.campaignId}:${ad.id}`) ?? 1,
        createdAt: ad.createdAt.toISOString(),
        campaign: {
          id: ad.campaign.id,
          name: ad.campaign.name,
          platform: ad.campaign.platform,
          status: ad.campaign.status,
          publishedAt: ad.campaign.publishedAt?.toISOString() ?? null,
        },
        offering: ad.campaign.offering,
        site: ad.campaign.site,
        hasPerformance,
        metrics: hasPerformance
          ? {
              spendCents: sum.spendCents,
              impressions: sum.impressions,
              clicks: sum.clicks,
              conversions: sum.conversions,
              ctr: sum.impressions > 0 ? sum.clicks / sum.impressions : null,
            }
          : null,
      };
    }),
  });
}
