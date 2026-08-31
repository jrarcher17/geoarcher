import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import {
  ingestManualProduct,
  ingestProductPage,
} from "@/lib/advertising/product-ingest";

export const maxDuration = 120;

/** Products and services the user added or extracted from a page. */
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

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const mode = body?.mode === "manual" ? "manual" : "page";

  try {
    const product =
      mode === "manual"
        ? await ingestManualProduct(session.user.id, {
            name: typeof body?.name === "string" ? body.name : "",
            description:
              typeof body?.description === "string" ? body.description : "",
            kind: body?.kind === "SERVICE" ? "SERVICE" : "PRODUCT",
            url: typeof body?.url === "string" ? body.url : null,
            price: typeof body?.price === "string" ? body.price : null,
            imageUrl: typeof body?.imageUrl === "string" ? body.imageUrl : null,
            companyName:
              typeof body?.companyName === "string" ? body.companyName : null,
          })
        : await ingestProductPage(
            session.user.id,
            typeof body?.url === "string" ? body.url : ""
          );
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not add that product.";
    const status =
      /sign in|not allowed|limit|upgrade|plan/i.test(message) ? 403 : 400;
    console.error("[products] add failed:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
