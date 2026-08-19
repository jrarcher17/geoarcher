import { prisma } from "./db";
import { getPlanLimits, planFromDb, type PlanId } from "./plans";

function startOfUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function userSiteIds(userId: string): Promise<string[]> {
  const rows = await prisma.userSite.findMany({
    where: { userId },
    select: { siteId: true },
  });
  return rows.map((r) => r.siteId);
}

export async function countUserScansThisMonth(userId: string): Promise<number> {
  const siteIds = await userSiteIds(userId);
  if (siteIds.length === 0) return 0;

  return prisma.scan.count({
    where: {
      createdAt: { gte: startOfUtcMonth() },
      OR: [
        { siteId: { in: siteIds } },
        { benchmarkScan: { siteId: { in: siteIds } } },
      ],
    },
  });
}

export async function getPlanForUser(userId: string | null): Promise<PlanId> {
  if (!userId) return "free";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  return planFromDb(user?.plan);
}

export async function getPlanLimitsForUser(userId: string | null) {
  const plan = await getPlanForUser(userId);
  return getPlanLimits(plan);
}

/** Resolve plan from the first user linked to a site's scans. */
export async function getPlanForSiteId(siteId: string): Promise<PlanId> {
  const link = await prisma.userSite.findFirst({
    where: { siteId },
    select: { userId: true },
  });
  return getPlanForUser(link?.userId ?? null);
}

export async function getPlanForScanId(scanId: string): Promise<PlanId> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { siteId: true, benchmarkScanId: true },
  });
  if (!scan) return "free";
  if (scan.benchmarkScanId) {
    const parent = await prisma.scan.findUnique({
      where: { id: scan.benchmarkScanId },
      select: { siteId: true },
    });
    if (parent) return getPlanForSiteId(parent.siteId);
  }
  return getPlanForSiteId(scan.siteId);
}

export async function countUserSites(userId: string): Promise<number> {
  return prisma.userSite.count({ where: { userId } });
}

export async function assertCanAddSite(userId: string): Promise<string | null> {
  const plan = await getPlanForUser(userId);
  const limits = getPlanLimits(plan);
  if (limits.sites == null) return null;
  const count = await countUserSites(userId);
  if (count >= limits.sites) {
    const next =
      plan === "free"
        ? "Upgrade to Pro for 100 sites."
        : plan === "pro"
          ? "Upgrade to Pro Plus for 200 sites."
          : "You've reached the site limit for this plan.";
    return `Your ${limits.label} plan includes ${limits.sites} sites. ${next}`;
  }
  return null;
}

export async function assertCanStartScan(
  userId: string,
  additionalScans = 1
): Promise<string | null> {
  const plan = await getPlanForUser(userId);
  const limits = getPlanLimits(plan);
  const used = await countUserScansThisMonth(userId);
  if (used + additionalScans > limits.scansPerMonth) {
    return `You've used ${used} of ${limits.scansPerMonth} scans this month on ${limits.label}. Upgrade to Pro for ${getPlanLimits("pro").scansPerMonth} scans per month.`;
  }
  return null;
}

export async function userOwnsSite(
  userId: string,
  siteId: string
): Promise<boolean> {
  const link = await prisma.userSite.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });
  return Boolean(link);
}

export async function userOwnsScan(
  userId: string,
  scanId: string
): Promise<boolean> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { siteId: true, benchmarkScanId: true },
  });
  if (!scan) return false;
  if (await userOwnsSite(userId, scan.siteId)) return true;
  if (scan.benchmarkScanId) {
    const parent = await prisma.scan.findUnique({
      where: { id: scan.benchmarkScanId },
      select: { siteId: true },
    });
    if (parent) return userOwnsSite(userId, parent.siteId);
  }
  return false;
}
