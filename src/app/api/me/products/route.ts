import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";

/** Products and services extracted from the user's scanned websites. */
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

  const offerings = await prisma.offering.findMany({
    where: { siteId: { in: siteIds } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: {
      images: { take: 1, orderBy: { createdAt: "asc" } },
      site: {
        select: {
          id: true,
          url: true,
          intelligence: { select: { business: true } },
        },
      },
    },
  });

  return NextResponse.json({
    products: offerings.map((o) => {
      const business = o.site.intelligence?.business as
        | { companyName?: string; industry?: string }
        | null;
      const details = o.details as {
        benefits?: string[];
        features?: string[];
        category?: string | null;
        targetAudience?: string[];
        cta?: string | null;
      } | null;
      return {
        id: o.id,
        kind: o.kind,
        name: o.name,
        description: o.description,
        price: o.price,
        url: o.url,
        image: o.images[0]
          ? { url: o.images[0].url, alt: o.images[0].alt }
          : null,
        category: details?.category ?? null,
        benefits: details?.benefits?.slice(0, 3) ?? [],
        features: details?.features?.slice(0, 4) ?? [],
        targetAudience: details?.targetAudience?.slice(0, 4) ?? [],
        cta: details?.cta ?? null,
        siteId: o.site.id,
        siteUrl: o.site.url,
        companyName: business?.companyName ?? null,
        industry: business?.industry ?? null,
      };
    }),
  });
}
