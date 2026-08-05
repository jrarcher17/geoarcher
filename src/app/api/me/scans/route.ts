import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import type { GeoScore, Understanding } from "@/lib/types";

/** Recent scans across all of the user's sites. */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const links = await prisma.userSite.findMany({
    where: { userId: session.user.id },
    select: { siteId: true },
  });
  const siteIds = links.map((l) => l.siteId);

  const scans = await prisma.scan.findMany({
    where: { siteId: { in: siteIds }, benchmarkScanId: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      site: { select: { id: true, url: true } },
      analysis: { select: { geoScore: true, understanding: true } },
    },
  });

  return NextResponse.json({
    scans: scans.map((s) => {
      const geo = s.analysis?.geoScore as GeoScore | undefined;
      const u = s.analysis?.understanding as Understanding | undefined;
      return {
        id: s.id,
        siteId: s.site.id,
        siteUrl: s.site.url,
        status: s.status,
        error: s.error,
        pagesCrawled: s.pagesCrawled,
        createdAt: s.createdAt.toISOString(),
        finishedAt: s.finishedAt?.toISOString() ?? null,
        geoOverall: geo?.overall ?? null,
        understanding: u?.confidence ?? null,
      };
    }),
  });
}
