import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSiteAccess } from "@/lib/advertising/api-guard";
import { startAdvertisingIntelligence } from "@/lib/jobs/start";

/** Full advertising intelligence for a site: profile, offerings, images, opportunities. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSiteAccess(siteId);
  if (access instanceof NextResponse) return access;

  const [intelligence, offerings, images, opportunities, hasScan] =
    await Promise.all([
      prisma.siteIntelligence.findUnique({ where: { siteId } }),
      prisma.offering.findMany({
        where: { siteId },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        include: { images: { take: 4 } },
      }),
      prisma.siteImage.findMany({
        where: { siteId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.adOpportunity.findMany({
        where: { siteId, dismissed: false },
        orderBy: [{ level: "asc" }, { createdAt: "asc" }],
        include: { offering: { select: { id: true, name: true, kind: true } } },
      }),
      prisma.scan.findFirst({
        where: { siteId, status: "COMPLETE", benchmarkScanId: null },
        select: { id: true },
      }),
    ]);

  return NextResponse.json({
    status: intelligence?.status ?? null,
    error: intelligence?.error ?? null,
    updatedAt: intelligence?.updatedAt.toISOString() ?? null,
    scanId: intelligence?.scanId ?? null,
    hasCompletedScan: Boolean(hasScan),
    business: intelligence?.business ?? null,
    marketing: intelligence?.marketing ?? null,
    offerings: offerings.map((o) => ({
      id: o.id,
      kind: o.kind,
      name: o.name,
      description: o.description,
      price: o.price,
      url: o.url,
      details: o.details ?? null,
      images: o.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt })),
    })),
    images: images.map((i) => ({
      id: i.id,
      url: i.url,
      alt: i.alt,
      pageUrl: i.pageUrl,
      offeringId: i.offeringId,
    })),
    opportunities: opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      level: o.level,
      rationale: o.rationale,
      channels: o.channels,
      recommendedCampaign: o.recommendedCampaign ?? null,
      offering: o.offering,
    })),
  });
}

/** Re-run the advertising-intelligence extraction from the latest completed scan. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSiteAccess(siteId);
  if (access instanceof NextResponse) return access;

  const scan = await prisma.scan.findFirst({
    where: { siteId, status: "COMPLETE", benchmarkScanId: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, pagesCrawled: true },
  });
  if (!scan || scan.pagesCrawled === 0) {
    return NextResponse.json(
      { error: "Scan this site first — intelligence is extracted from a completed scan." },
      { status: 409 }
    );
  }

  await prisma.siteIntelligence.upsert({
    where: { siteId },
    create: { siteId, scanId: scan.id, status: "RUNNING" },
    update: { scanId: scan.id, status: "RUNNING", error: null },
  });
  await startAdvertisingIntelligence(siteId, scan.id);

  return NextResponse.json({ started: true });
}
