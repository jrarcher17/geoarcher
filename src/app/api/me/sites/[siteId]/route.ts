import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { siteId } = await params;
  const link = await prisma.userSite.findUnique({
    where: { userId_siteId: { userId: session.user.id, siteId } },
    include: {
      site: {
        include: {
          scans: {
            where: { benchmarkScanId: null },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              status: true,
              createdAt: true,
              finishedAt: true,
              pagesCrawled: true,
            },
          },
        },
      },
    },
  });
  if (!link) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const scans = link.site.scans;
  const latestComplete = scans.find((s) => s.status === "COMPLETE");
  return NextResponse.json({
    siteId: link.site.id,
    url: link.site.url,
    geoKey: link.site.geoKey,
    latestScanId: scans[0]?.id ?? null,
    latestCompleteScanId: latestComplete?.id ?? null,
    scans: scans.map((s) => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      finishedAt: s.finishedAt?.toISOString() ?? null,
      pagesCrawled: s.pagesCrawled,
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { siteId } = await params;

  const link = await prisma.userSite.findUnique({
    where: {
      userId_siteId: { userId: session.user.id, siteId },
    },
    include: { site: { select: { url: true } } },
  });

  if (!link) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  await prisma.site.delete({ where: { id: siteId } });

  return NextResponse.json({ ok: true, url: link.site.url });
}
