import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";

/** Everything the advertising command center dashboard needs in one call. */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = session.user.id;

  const links = await prisma.userSite.findMany({
    where: { userId },
    select: {
      site: {
        select: {
          id: true,
          url: true,
          intelligence: {
            select: { status: true, business: true, updatedAt: true },
          },
          scans: {
            where: { benchmarkScanId: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, createdAt: true },
          },
          _count: {
            select: {
              offerings: true,
              siteImages: true,
              adOpportunities: { where: { dismissed: false } },
            },
          },
        },
      },
    },
  });
  const siteIds = links.map((l) => l.site.id);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [campaignCounts, metrics, opportunities, connections, recommendations] =
    await Promise.all([
      prisma.adCampaign.groupBy({
        by: ["status"],
        where: { userId },
        _count: true,
      }),
      prisma.campaignMetric.aggregate({
        where: { campaign: { userId }, date: { gte: since } },
        _sum: {
          spendCents: true,
          impressions: true,
          clicks: true,
          conversions: true,
          revenueCents: true,
        },
      }),
      prisma.adOpportunity.findMany({
        where: { siteId: { in: siteIds }, dismissed: false },
        orderBy: [{ level: "asc" }, { createdAt: "asc" }],
        take: 6,
        include: {
          site: { select: { id: true, url: true } },
          offering: { select: { id: true, name: true, kind: true } },
        },
      }),
      prisma.adPlatformConnection.findMany({
        where: { userId },
        select: { platform: true, status: true, accountName: true },
      }),
      prisma.aIRecommendation.findMany({
        where: { userId, status: "NEW" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const countByStatus = new Map(campaignCounts.map((c) => [c.status, c._count]));
  const totalCampaigns = campaignCounts.reduce((n, c) => n + c._count, 0);
  const sums = metrics._sum;
  const spendCents = sums.spendCents ?? 0;
  const conversions = sums.conversions ?? 0;
  const revenueCents = sums.revenueCents ?? 0;

  const google = connections.find((c) => c.platform === "GOOGLE");
  const meta = connections.find((c) => c.platform === "META");

  return NextResponse.json({
    kpis: {
      activeCampaigns: countByStatus.get("ACTIVE") ?? 0,
      draftCampaigns: countByStatus.get("DRAFT") ?? 0,
      totalCampaigns,
      spendCents,
      impressions: sums.impressions ?? 0,
      clicks: sums.clicks ?? 0,
      conversions,
      cpaCents: conversions > 0 ? Math.round(spendCents / conversions) : null,
      roas: spendCents > 0 ? revenueCents / spendCents : null,
    },
    sites: links.map(({ site }) => ({
      siteId: site.id,
      url: site.url,
      latestScan: site.scans[0] ?? null,
      intelligenceStatus: site.intelligence?.status ?? null,
      business: site.intelligence?.business ?? null,
      offerings: site._count.offerings,
      images: site._count.siteImages,
      opportunities: site._count.adOpportunities,
    })),
    opportunities: opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      level: o.level,
      rationale: o.rationale,
      channels: o.channels,
      siteId: o.site.id,
      siteUrl: o.site.url,
      offering: o.offering,
    })),
    connections: {
      google: {
        connected: google?.status === "CONNECTED",
        accountName: google?.accountName ?? null,
      },
      meta: {
        connected: meta?.status === "CONNECTED",
        accountName: meta?.accountName ?? null,
      },
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
    alerts: recommendations.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      detail: r.detail,
      campaignId: r.campaignId,
    })),
  });
}
