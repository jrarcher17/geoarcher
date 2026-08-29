import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { discoverCompetitors } from "@/lib/advertising/competitors";

/** Run AI competitor discovery from stored product intelligence. */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { siteId?: string };
  const requested = typeof body.siteId === "string" ? body.siteId : "";

  const links = await prisma.userSite.findMany({
    where: { userId: session.user.id },
    select: { siteId: true },
  });
  const owned = new Set(links.map((l) => l.siteId));

  const siteIds = requested
    ? owned.has(requested)
      ? [requested]
      : []
    : [...owned];

  if (requested && siteIds.length === 0) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const ready = await prisma.siteIntelligence.findMany({
    where: { siteId: { in: siteIds }, status: "COMPLETE" },
    select: { siteId: true },
  });

  if (ready.length === 0) {
    return NextResponse.json(
      {
        error:
          "Scan a website first. Competitors are suggested from product intelligence — not invented.",
      },
      { status: 409 }
    );
  }

  let created = 0;
  const errors: string[] = [];
  for (const row of ready) {
    try {
      const result = await discoverCompetitors(row.siteId);
      created += result.created;
      if (result.error) errors.push(result.error);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (created === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 500 });
  }

  return NextResponse.json({ created, sites: ready.length });
}
