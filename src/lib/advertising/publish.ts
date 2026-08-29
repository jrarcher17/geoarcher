import { prisma } from "@/lib/db";
import { getLiveAccessToken } from "@/lib/advertising/connections";
import {
  publishGoogleCampaign,
  setGoogleCampaignStatus,
} from "@/lib/advertising/platforms/google";
import {
  publishMetaCampaign,
  setMetaCampaignStatus,
} from "@/lib/advertising/platforms/meta";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function publishCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    include: { ads: true },
  });
  if (!campaign || campaign.userId !== userId) {
    throw new Error("Campaign not found.");
  }
  if (campaign.platform === "AI_CHAT") {
    throw new Error(
      "ChatGPT ads can be prepared here. There is no official ads API, so they cannot be published."
    );
  }
  if (campaign.status !== "READY") {
    throw new Error("Only Ready campaigns can be published.");
  }
  if (!campaign.landingPage) {
    throw new Error("A landing page is required to publish.");
  }
  if (!campaign.budgetDailyCents || campaign.budgetDailyCents < 100) {
    throw new Error("Set a daily budget of at least $1 before publishing.");
  }

  const platform = campaign.platform === "GOOGLE" ? "google" : "meta";
  const live = await getLiveAccessToken(userId, platform);
  const ad = campaign.ads[0];
  const copy = asRecord(ad?.copy);
  const structure = asRecord(campaign.structure);
  const creative = asRecord(ad?.creative);

  try {
    const external =
      platform === "google"
        ? await publishGoogleCampaign(live.accessToken, live.accountId, {
            name: campaign.name,
            budgetDailyCents: campaign.budgetDailyCents,
            landingPage: campaign.landingPage,
            headlines: strings(copy.headlines),
            descriptions: strings(copy.descriptions),
            keywords: strings(copy.keywords),
            adGroupName: String(structure.adGroupName ?? campaign.name),
          })
        : await publishMetaCampaign(live.accessToken, live.accountId, {
            name: campaign.name,
            goal: campaign.goal,
            budgetDailyCents: campaign.budgetDailyCents,
            landingPage: campaign.landingPage,
            primaryText: String(copy.primaryText ?? ""),
            headline: strings(copy.headlines)[0] ?? campaign.name,
            description: strings(copy.descriptions)[0] ?? "",
            cta: String(copy.cta ?? structure.cta ?? "LEARN_MORE"),
            imageUrl: typeof creative.url === "string" ? creative.url : null,
            adSetName: String(structure.adSetName ?? campaign.name),
          });

    const updated = await prisma.adCampaign.update({
      where: { id: campaignId },
      data: {
        status: "ACTIVE",
        externalId: external.campaignId,
        publishedAt: new Date(),
        error: null,
      },
    });

    await prisma.aIAction.create({
      data: {
        userId,
        action: "campaign_published",
        platform: campaign.platform,
        campaignId,
        status: "EXECUTED",
        approvedBy: userId,
        newValue: { externalId: external.campaignId, accountId: live.accountId },
        executedAt: new Date(),
      },
    });

    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed.";
    await prisma.adCampaign.update({
      where: { id: campaignId },
      data: { status: "ERROR", error: message },
    });
    await prisma.aIAction.create({
      data: {
        userId,
        action: "campaign_publish_failed",
        platform: campaign.platform,
        campaignId,
        status: "FAILED",
        newValue: { error: message },
        executedAt: new Date(),
      },
    });
    throw err;
  }
}

export async function syncPlatformStatus(
  userId: string,
  campaignId: string,
  next: "ACTIVE" | "PAUSED"
) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { userId: true, platform: true, externalId: true },
  });
  if (!campaign || campaign.userId !== userId || !campaign.externalId) return;

  const platform = campaign.platform === "GOOGLE" ? "google" : "meta";
  if (campaign.platform === "AI_CHAT") return;
  const live = await getLiveAccessToken(userId, platform);
  if (platform === "google") {
    await setGoogleCampaignStatus(
      live.accessToken,
      live.accountId,
      campaign.externalId,
      next === "ACTIVE" ? "ENABLED" : "PAUSED"
    );
  } else {
    await setMetaCampaignStatus(live.accessToken, campaign.externalId, next);
  }
}
