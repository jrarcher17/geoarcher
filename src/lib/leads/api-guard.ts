import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadGenMonthlyQuota } from "@/lib/plans";
import { getServerSession } from "@/lib/session";
import { getPlanForUser } from "@/lib/user-plan";

export interface LeadGenAccess {
  userId: string;
}

/** Session + Pro Plus gate shared by all Lead Machine routes. */
export async function requireLeadGenAccess(): Promise<
  LeadGenAccess | NextResponse
> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = session.user.id;
  const plan = await getPlanForUser(userId);
  if (plan !== "proPlus") {
    return NextResponse.json(
      {
        error: "The AI Lead Generation Machine is available on Pro Plus.",
        upgradeRequired: true,
      },
      { status: 403 }
    );
  }
  return { userId };
}

function startOfUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Statuses that consume the monthly quota. Apollo search + a health crawl are
 * free; we only meter prospects we try to contact (email reveal + outreach).
 * DISQUALIFIED / FAILED / still-analyzing rows do not count.
 */
export const QUOTA_STATUSES = [
  "QUALIFIED",
  "CONTACTED",
  "REPLIED",
  "BOUNCED",
  "CLOSED",
] as const;

/** Billable prospects created this calendar month (not healthy-site skips). */
export async function countProspectsThisMonth(userId: string): Promise<number> {
  return prisma.prospect.count({
    where: {
      createdAt: { gte: startOfUtcMonth() },
      campaign: { userId },
      status: { in: [...QUOTA_STATUSES] },
    },
  });
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
}

export async function getQuotaState(userId: string): Promise<QuotaState> {
  const limit = leadGenMonthlyQuota();
  const used = await countProspectsThisMonth(userId);
  return { used, limit, remaining: Math.max(0, limit - used) };
}
