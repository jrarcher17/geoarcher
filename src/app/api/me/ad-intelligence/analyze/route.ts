import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { analyzeStoredLibraryAds } from "@/lib/advertising/library-analysis";

/**
 * AI analysis for stored official-library ads only.
 * Does not invent ads, spend, or measured performance.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    offering?: string;
    competitor?: string;
    force?: boolean;
  };

  const links = await prisma.userSite.findMany({
    where: { userId: session.user.id },
    select: { siteId: true },
  });
  const siteIds = links.map((l) => l.siteId);
  if (siteIds.length === 0) {
    return NextResponse.json({ error: "Add a website first." }, { status: 409 });
  }

  const adId = typeof body.id === "string" ? body.id : undefined;
  const offeringId = typeof body.offering === "string" ? body.offering : undefined;
  const competitorId = typeof body.competitor === "string" ? body.competitor : undefined;

  if (!adId && !offeringId && !competitorId) {
    return NextResponse.json(
      { error: "Choose a stored ad, product, or competitor to analyze." },
      { status: 400 }
    );
  }

  if (offeringId) {
    const offering = await prisma.offering.findFirst({
      where: { id: offeringId, siteId: { in: siteIds } },
      select: { id: true },
    });
    if (!offering) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
  }

  if (competitorId) {
    const competitor = await prisma.adCompetitor.findFirst({
      where: { id: competitorId, siteId: { in: siteIds } },
      select: { id: true },
    });
    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
    }
  }

  try {
    const result = await analyzeStoredLibraryAds({
      siteIds,
      adId,
      offeringId,
      competitorId,
      force: body.force === true,
    });
    if (result.error && result.analyzed === 0) {
      const status = result.error.includes("OPENAI_API_KEY") ? 503 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
