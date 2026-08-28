import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { publishCampaign, syncPlatformStatus } from "@/lib/advertising/publish";
import { isActionType, type ActionType } from "@/lib/advertising/recommend";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

export interface ActionPayload {
  action: ActionType;
  campaignId: string;
  budgetDailyCents?: number;
}

export function parsePayload(value: unknown): ActionPayload | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (!isActionType(String(rec.action))) return null;
  if (typeof rec.campaignId !== "string") return null;
  const budget =
    typeof rec.budgetDailyCents === "number" && rec.budgetDailyCents > 0
      ? Math.round(rec.budgetDailyCents)
      : undefined;
  return { action: rec.action as ActionType, campaignId: rec.campaignId, budgetDailyCents: budget };
}

export async function executeApprovedAction(userId: string, actionId: string) {
  const row = await prisma.aIAction.findUnique({ where: { id: actionId } });
  if (!row || row.userId !== userId) throw new Error("Action not found.");
  if (row.status !== "PENDING") throw new Error("This action is no longer pending.");

  const payload = parsePayload(row.newValue);
  if (!payload) throw new Error("This action has an invalid payload.");

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: payload.campaignId },
  });
  if (!campaign || campaign.userId !== userId) {
    throw new Error("The campaign for this action is gone.");
  }

  try {
    switch (payload.action) {
      case "mark_ready":
        if (campaign.status !== "DRAFT") {
          throw new Error("Only draft campaigns can be marked Ready.");
        }
        await prisma.adCampaign.update({
          where: { id: campaign.id },
          data: { status: "READY" },
        });
        break;
      case "pause_campaign":
        if (campaign.status !== "ACTIVE") {
          throw new Error("Only active campaigns can be paused.");
        }
        if (campaign.externalId) {
          await syncPlatformStatus(userId, campaign.id, "PAUSED");
        }
        await prisma.adCampaign.update({
          where: { id: campaign.id },
          data: { status: "PAUSED" },
        });
        break;
      case "resume_campaign":
        if (campaign.status !== "PAUSED") {
          throw new Error("Only paused campaigns can be resumed.");
        }
        if (campaign.externalId) {
          await syncPlatformStatus(userId, campaign.id, "ACTIVE");
        }
        await prisma.adCampaign.update({
          where: { id: campaign.id },
          data: { status: "ACTIVE" },
        });
        break;
      case "change_budget":
        if (!payload.budgetDailyCents || payload.budgetDailyCents < 100) {
          throw new Error("Budget must be at least $1/day.");
        }
        if (campaign.externalId) {
          throw new Error(
            "Live budget edits aren’t available yet. Change the budget in the ad platform, or pause the campaign here."
          );
        }
        await prisma.adCampaign.update({
          where: { id: campaign.id },
          data: { budgetDailyCents: payload.budgetDailyCents },
        });
        break;
      case "publish_campaign":
        await publishCampaign(userId, campaign.id);
        break;
    }

    const updated = await prisma.aIAction.update({
      where: { id: actionId },
      data: {
        status: "EXECUTED",
        approvedBy: userId,
        executedAt: new Date(),
        error: null,
      },
    });
    await prisma.aIRecommendation.updateMany({
      where: { userId, campaignId: campaign.id, type: payload.action, status: "NEW" },
      data: { status: "APPLIED" },
    });
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed.";
    await prisma.aIAction.update({
      where: { id: actionId },
      data: { status: "FAILED", error: message, executedAt: new Date(), approvedBy: userId },
    });
    throw err;
  }
}

export async function rejectAction(userId: string, actionId: string) {
  const row = await prisma.aIAction.findUnique({ where: { id: actionId } });
  if (!row || row.userId !== userId) throw new Error("Action not found.");
  if (row.status !== "PENDING") throw new Error("This action is no longer pending.");
  const payload = parsePayload(row.newValue);
  const updated = await prisma.aIAction.update({
    where: { id: actionId },
    data: { status: "REJECTED", approvedBy: userId, executedAt: new Date() },
  });
  if (payload) {
    await prisma.aIRecommendation.updateMany({
      where: { userId, campaignId: payload.campaignId, type: payload.action, status: "NEW" },
      data: { status: "DISMISSED" },
    });
  }
  return updated;
}

export async function queueAction(
  userId: string,
  payload: ActionPayload,
  meta: { title: string; detail: string; platform?: "GOOGLE" | "META" | "AI_CHAT" }
) {
  const existing = await prisma.aIAction.findFirst({
    where: {
      userId,
      status: "PENDING",
      campaignId: payload.campaignId,
      action: payload.action,
    },
  });
  if (existing) return existing;

  return prisma.aIAction.create({
    data: {
      userId,
      action: payload.action,
      platform: meta.platform,
      campaignId: payload.campaignId,
      previousValue: asJson({ title: meta.title }),
      newValue: asJson({ ...payload, detail: meta.detail }),
      status: "PENDING",
    },
  });
}
