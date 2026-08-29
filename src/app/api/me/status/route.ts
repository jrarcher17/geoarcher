import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";

/** Compact live-status strip for the app chrome (advertising command center). */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = session.user.id;

  const links = await prisma.userSite.findMany({
    where: { userId },
    select: { siteId: true },
  });
  const siteIds = links.map((l) => l.siteId);

  const [scannedSites, scanning, offerings, opportunities, competitors, libraryAds, analyzedAds, campaigns, activeCampaigns] =
    await Promise.all([
      prisma.scan.groupBy({
        by: ["siteId"],
        where: { siteId: { in: siteIds }, status: "COMPLETE", benchmarkScanId: null },
      }),
      prisma.scan.count({
        where: {
          siteId: { in: siteIds },
          status: { in: ["QUEUED", "CRAWLING", "ANALYZING"] },
        },
      }),
      prisma.offering.count({ where: { siteId: { in: siteIds } } }),
      prisma.adOpportunity.count({
        where: { siteId: { in: siteIds }, dismissed: false },
      }),
      prisma.adCompetitor.count({
        where: { siteId: { in: siteIds }, dismissed: false },
      }),
      prisma.libraryAd.count({ where: { siteId: { in: siteIds } } }),
      prisma.libraryAd.count({
        where: { siteId: { in: siteIds }, analyzedAt: { not: null } },
      }),
      prisma.adCampaign.count({ where: { userId } }),
      prisma.adCampaign.count({ where: { userId, status: "ACTIVE" } }),
    ]);

  return NextResponse.json({
    active: scannedSites.length > 0 || campaigns > 0,
    scanning: scanning > 0,
    sites: scannedSites.length,
    offerings,
    opportunities,
    competitors,
    libraryAds,
    analyzedAds,
    campaigns,
    activeCampaigns,
  });
}
