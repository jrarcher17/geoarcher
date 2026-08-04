import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import type { GeoScore, Understanding } from "@/lib/types";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const links = await prisma.userSite.findMany({
    where: { userId: session.user.id },
    include: {
      site: {
        include: {
          scans: {
            where: { benchmarkScanId: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { analysis: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const sites = links.map((link) => {
    const scan = link.site.scans[0];
    const understanding = scan?.analysis?.understanding as
      | Understanding
      | undefined;
    const geo = scan?.analysis?.geoScore as GeoScore | undefined;
    return {
      siteId: link.site.id,
      url: link.site.url,
      addedAt: link.createdAt.toISOString(),
      latestScan: scan
        ? {
            id: scan.id,
            status: scan.status,
            createdAt: scan.createdAt.toISOString(),
            geoOverall: geo?.overall ?? null,
            understanding: understanding?.confidence ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    sites,
  });
}
