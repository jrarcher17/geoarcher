import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { AssistantContext } from "@/lib/advertising/context";
import { formatMoney } from "@/lib/advertising/format";

export const ACTION_TYPES = [
  "pause_campaign",
  "resume_campaign",
  "change_budget",
  "mark_ready",
  "publish_campaign",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export function isActionType(value: string): value is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(value);
}

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

/**
 * Deterministic recommendations from real campaigns/offerings only.
 * Replaces outstanding NEW rows so the dashboard doesn't accumulate stale alerts.
 */
export async function refreshRecommendations(userId: string, ctx: AssistantContext) {
  await prisma.aIRecommendation.updateMany({
    where: { userId, status: "NEW" },
    data: { status: "REVIEWED" },
  });

  const rows: Prisma.AIRecommendationCreateManyInput[] = [];

  for (const c of ctx.campaigns) {
    if (c.status === "DRAFT") {
      rows.push({
        userId,
        campaignId: c.id,
        type: "mark_ready",
        title: `Approve “${c.name}”`,
        detail: `This ${c.platform === "GOOGLE" ? "Google" : "Meta"} campaign is still a draft. Mark it Ready after you review the ads.`,
        payload: asJson({ action: "mark_ready", campaignId: c.id }),
      });
    }
    if (c.status === "READY") {
      const connected =
        (c.platform === "GOOGLE" && ctx.connections.google) ||
        (c.platform === "META" && ctx.connections.meta);
      if (connected) {
        rows.push({
          userId,
          campaignId: c.id,
          type: "publish_campaign",
          title: `Publish “${c.name}”`,
          detail: `Ready to go live on ${c.platform === "GOOGLE" ? "Google Ads" : "Meta"}. Publishing starts spend at ${c.budgetDailyCents ? `${formatMoney(c.budgetDailyCents)}/day` : "the set daily budget"}.`,
          payload: asJson({ action: "publish_campaign", campaignId: c.id }),
        });
      } else {
        rows.push({
          userId,
          campaignId: c.id,
          type: "connect_platform",
          title: `Connect ${c.platform === "GOOGLE" ? "Google Ads" : "Meta"} to publish`,
          detail: `“${c.name}” is Ready but ${c.platform === "GOOGLE" ? "Google Ads" : "Meta"} isn’t connected, so it can’t spend yet.`,
          payload: asJson({ href: "/integrations" }),
        });
      }
    }
    if (
      c.status === "ACTIVE" &&
      c.metrics.spendCents > 0 &&
      c.metrics.conversions === 0 &&
      c.metrics.clicks >= 10
    ) {
      rows.push({
        userId,
        campaignId: c.id,
        type: "pause_campaign",
        title: `Review spend on “${c.name}”`,
        detail: `${formatMoney(c.metrics.spendCents)} spent with ${c.metrics.clicks} clicks and no conversions in the last 30 days. Pause requires your approval.`,
        payload: asJson({ action: "pause_campaign", campaignId: c.id }),
      });
    }
  }

  const advertised = new Set(
    ctx.campaigns.map((c) => c.offeringName).filter((n): n is string => Boolean(n))
  );
  for (const o of ctx.offerings) {
    if (advertised.has(o.name)) continue;
    if (!o.opportunityTitle) continue;
    rows.push({
      userId,
      type: "create_campaign",
      title: `Advertise ${o.name}`,
      detail: `${o.opportunityTitle} Open Ad Studio to draft ads from the website copy.`,
      payload: asJson({ href: `/ad-studio?site=${o.siteId}&offering=${o.id}` }),
    });
    if (rows.filter((r) => r.type === "create_campaign").length >= 3) break;
  }

  const created = rows.slice(0, 8);
  if (created.length > 0) {
    await prisma.aIRecommendation.createMany({ data: created });
  }
  return prisma.aIRecommendation.findMany({
    where: { userId, status: "NEW" },
    orderBy: { createdAt: "desc" },
  });
}
