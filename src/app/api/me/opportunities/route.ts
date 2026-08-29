import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import {
  MIN_ANALYZED_FOR_GAPS,
  findCompetitorGaps,
  scoreForSites,
} from "@/lib/advertising/library-gaps";
import { parseGapDetails, toOpportunityDto } from "@/lib/advertising/opportunity-dto";

async function ownedSiteIds(userId: string): Promise<string[]> {
  const links = await prisma.userSite.findMany({
    where: { userId },
    select: { siteId: true },
  });
  return links.map((l) => l.siteId);
}

/** Site opportunities + competitor-gap opportunities from real analyses. */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const siteIds = await ownedSiteIds(session.user.id);
  const [rows, analyzedCount, libraryAdCount, score, siteCount] = await Promise.all([
    prisma.adOpportunity.findMany({
      where: { siteId: { in: siteIds }, dismissed: false },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }],
      include: {
        site: { select: { id: true, url: true } },
        offering: { select: { id: true, name: true, kind: true } },
      },
    }),
    prisma.libraryAd.count({
      where: { siteId: { in: siteIds }, analyzedAt: { not: null } },
    }),
    prisma.libraryAd.count({ where: { siteId: { in: siteIds } } }),
    scoreForSites(siteIds),
    prisma.userSite.count({ where: { userId: session.user.id } }),
  ]);

  const site = rows.filter((r) => r.source === "SITE").map(toOpportunityDto);
  const gaps = rows.filter((r) => r.source === "COMPETITOR_GAP").map((r) => ({
    ...toOpportunityDto(r),
    gap: parseGapDetails(r.details),
  }));

  return NextResponse.json({
    site,
    gaps,
    score,
    analyzedCount,
    libraryAdCount,
    canFindGaps: analyzedCount >= MIN_ANALYZED_FOR_GAPS,
    hasSites: siteCount > 0,
  });
}

/** Find competitor-gap opportunities from stored library analyses. */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { siteId?: string };
  const requested = typeof body.siteId === "string" ? body.siteId : "";
  const owned = new Set(await ownedSiteIds(session.user.id));
  const siteIds = requested ? (owned.has(requested) ? [requested] : []) : [...owned];

  if (requested && siteIds.length === 0) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (siteIds.length === 0) {
    return NextResponse.json({ error: "Add a website first." }, { status: 409 });
  }

  let created = 0;
  let analyzedCount = 0;
  const errors: string[] = [];

  for (const siteId of siteIds) {
    try {
      const result = await findCompetitorGaps(siteId);
      created += result.created;
      analyzedCount += result.analyzedCount;
      if (result.error) errors.push(result.error);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (created === 0 && errors.length > 0) {
    const message = errors[0];
    const status = message.includes("OPENAI_API_KEY") ? 503 : 409;
    return NextResponse.json({ error: message, analyzedCount }, { status });
  }

  return NextResponse.json({ created, sites: siteIds.length, analyzedCount });
}
