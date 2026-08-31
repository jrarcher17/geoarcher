import { prisma } from "@/lib/db";
import { dateKey, lastNDays } from "@/lib/advertising/metrics";
import { getChatgptAdsKey, getLiveAccessToken } from "@/lib/advertising/connections";
import { fetchChatgptInsights } from "@/lib/advertising/platforms/chatgpt";
import { fetchGoogleInsights } from "@/lib/advertising/platforms/google";
import { fetchMetaInsights } from "@/lib/advertising/platforms/meta";

/** Pull the last N days of real platform metrics into CampaignMetric. */
export async function syncUserCampaignMetrics(userId: string, days = 30): Promise<number> {
  const { keys } = lastNDays(days);
  const since = keys[0];
  const until = keys[keys.length - 1];

  const campaigns = await prisma.adCampaign.findMany({
    where: {
      userId,
      externalId: { not: null },
      status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] },
      platform: { in: ["GOOGLE", "META", "AI_CHAT"] },
    },
    select: { id: true, platform: true, externalId: true },
  });

  let upserts = 0;
  for (const campaign of campaigns) {
    if (!campaign.externalId) continue;
    try {
      let rows;
      if (campaign.platform === "AI_CHAT") {
        const live = await getChatgptAdsKey(userId);
        rows = await fetchChatgptInsights(
          live.apiKey,
          campaign.externalId,
          since,
          until
        );
      } else if (campaign.platform === "GOOGLE") {
        const live = await getLiveAccessToken(userId, "google");
        rows = await fetchGoogleInsights(
          live.accessToken,
          live.accountId,
          campaign.externalId,
          since,
          until
        );
      } else {
        const live = await getLiveAccessToken(userId, "meta");
        rows = await fetchMetaInsights(
          live.accessToken,
          campaign.externalId,
          since,
          until
        );
      }

      for (const row of rows) {
        const date = new Date(`${dateKey(row.date)}T00:00:00.000Z`);
        await prisma.campaignMetric.upsert({
          where: { campaignId_date: { campaignId: campaign.id, date } },
          create: {
            campaignId: campaign.id,
            date,
            spendCents: row.spendCents,
            impressions: row.impressions,
            clicks: row.clicks,
            conversions: row.conversions,
            revenueCents: row.revenueCents,
          },
          update: {
            spendCents: row.spendCents,
            impressions: row.impressions,
            clicks: row.clicks,
            conversions: row.conversions,
            revenueCents: row.revenueCents,
          },
        });
        upserts += 1;
      }
    } catch (err) {
      console.error(`[ads-sync] campaign ${campaign.id}:`, err);
    }
  }
  return upserts;
}

export async function syncAllConnectedUsers(days = 30): Promise<number> {
  const users = await prisma.adPlatformConnection.findMany({
    where: { status: "CONNECTED", accountId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  let total = 0;
  for (const { userId } of users) {
    total += await syncUserCampaignMetrics(userId, days);
  }
  return total;
}
