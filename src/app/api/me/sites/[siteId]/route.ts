import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlanForUser } from "@/lib/user-plan";
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
  const plan = await getPlanForUser(session.user.id);
  return NextResponse.json({
    siteId: link.site.id,
    url: link.site.url,
    geoKey: link.site.geoKey,
    plan,
    canDeleteSite: plan !== "free",
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

  const plan = await getPlanForUser(session.user.id);
  if (plan === "free") {
    return NextResponse.json(
      {
        error:
          "Removing sites is available on Pro. Upgrade in Settings → Billing.",
      },
      { status: 403 }
    );
  }

  await prisma.userSite.delete({
    where: {
      userId_siteId: { userId: session.user.id, siteId },
    },
  });

  const otherLinks = await prisma.userSite.count({ where: { siteId } });
  if (otherLinks === 0) {
    await prisma.site.delete({ where: { id: siteId } });
  }

  return NextResponse.json({ ok: true, url: link.site.url });
}
