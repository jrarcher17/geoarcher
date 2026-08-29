import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { userOwnsSite } from "@/lib/user-plan";
import { addManualCompetitor } from "@/lib/advertising/competitors";

/** Competitors suggested from scans or added by the user. No ad counts. */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const links = await prisma.userSite.findMany({
    where: { userId: session.user.id },
    select: {
      site: {
        select: {
          id: true,
          url: true,
          intelligence: { select: { status: true, business: true } },
          offerings: {
            select: { id: true, name: true, kind: true },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });
  const siteIds = links.map((l) => l.site.id);

  const rows = await prisma.adCompetitor.findMany({
    where: { siteId: { in: siteIds }, dismissed: false },
    orderBy: [{ source: "asc" }, { name: "asc" }],
    include: {
      site: { select: { id: true, url: true } },
      offering: { select: { id: true, name: true, kind: true } },
    },
  });

  return NextResponse.json({
    competitors: rows.map((c) => {
      const business = links.find((l) => l.site.id === c.siteId)?.site.intelligence
        ?.business as { companyName?: string } | null;
      const details = (c.details ?? {}) as {
        similarProducts?: string[];
        searchTerms?: string[];
        customerProblems?: string[];
        customerIntent?: string[];
      };
      return {
        id: c.id,
        name: c.name,
        website: c.website,
        category: c.category,
        rationale: c.rationale,
        source: c.source,
        similarProducts: details.similarProducts ?? [],
        searchTerms: details.searchTerms ?? [],
        customerProblems: details.customerProblems ?? [],
        customerIntent: details.customerIntent ?? [],
        siteId: c.site.id,
        siteUrl: c.site.url,
        companyName: business?.companyName ?? null,
        offering: c.offering,
      };
    }),
    sites: links.map(({ site }) => {
      const business = site.intelligence?.business as
        | { companyName?: string }
        | null;
      return {
        id: site.id,
        url: site.url,
        companyName: business?.companyName ?? null,
        intelligenceReady: site.intelligence?.status === "COMPLETE",
        offerings: site.offerings,
      };
    }),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    siteId?: string;
    name?: string;
    website?: string;
    offeringId?: string;
  };
  const siteId = typeof body.siteId === "string" ? body.siteId : "";
  if (!siteId || !(await userOwnsSite(session.user.id, siteId))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const result = await addManualCompetitor({
    siteId,
    name: typeof body.name === "string" ? body.name : "",
    website: typeof body.website === "string" ? body.website : null,
    offeringId: typeof body.offeringId === "string" ? body.offeringId : null,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
