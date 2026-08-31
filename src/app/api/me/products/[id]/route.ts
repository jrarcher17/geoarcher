import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";

/** Full product intelligence for one offering the user owns. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const offering = await prisma.offering.findUnique({
    where: { id },
    include: {
      images: { orderBy: { createdAt: "asc" }, take: 8 },
      site: {
        select: {
          id: true,
          url: true,
          userSites: { where: { userId: session.user.id }, select: { id: true } },
          intelligence: { select: { business: true, marketing: true } },
        },
      },
    },
  });

  if (!offering || offering.site.userSites.length === 0) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const business = offering.site.intelligence?.business as
    | { companyName?: string; brand?: string; industry?: string; description?: string }
    | null;
  const details = (offering.details ?? {}) as {
    benefits?: string[];
    features?: string[];
    category?: string | null;
    targetAudience?: string[];
    cta?: string | null;
    location?: string | null;
  };

  return NextResponse.json({
    id: offering.id,
    kind: offering.kind,
    name: offering.name,
    description: offering.description,
    price: offering.price,
    url: offering.url,
    category: details.category ?? null,
    benefits: details.benefits ?? [],
    features: details.features ?? [],
    targetAudience: details.targetAudience ?? [],
    cta: details.cta ?? null,
    location: details.location ?? null,
    images: offering.images.map((i) => ({
      id: i.id,
      url: i.url,
      alt: i.alt,
    })),
    siteId: offering.site.id,
    siteUrl: offering.site.url,
    companyName: business?.companyName ?? null,
    brand: business?.brand ?? null,
    industry: business?.industry ?? null,
    companyDescription: business?.description ?? null,
    adCount: await prisma.ad.count({
      where: {
        campaign: { userId: session.user.id, offeringId: offering.id },
      },
    }),
  });
}

/** Remove a product and every My Ads row created for it. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const offering = await prisma.offering.findUnique({
    where: { id },
    include: {
      site: {
        select: {
          userSites: {
            where: { userId: session.user.id },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!offering || offering.site.userSites.length === 0) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const adCount = await prisma.ad.count({
    where: {
      campaign: { userId: session.user.id, offeringId: offering.id },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.adCampaign.deleteMany({
      where: { userId: session.user.id, offeringId: offering.id },
    });
    await tx.offering.delete({ where: { id: offering.id } });
  });

  return NextResponse.json({ ok: true, adCount });
}
