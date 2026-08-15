import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { dataForSeoConfigured } from "@/lib/seo/dataforseo";
import { MAX_TRACKED_KEYWORDS, runRankCheck } from "@/lib/seo/rank-tracker";
import type { SeoKeywordDto, SeoRankingsDto } from "@/lib/seo/types";

export const maxDuration = 300;

const HISTORY_POINTS = 30;

async function buildRankingsDto(siteId: string): Promise<SeoRankingsDto> {
  const keywords = await prisma.seoKeyword.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: HISTORY_POINTS },
    },
  });

  const dtos: SeoKeywordDto[] = keywords.map((k) => {
    const [latest, previous] = k.checks;
    return {
      id: k.id,
      keyword: k.keyword,
      position: latest?.position ?? null,
      previousPosition: previous?.position ?? null,
      url: latest?.url ?? null,
      topResults:
        (latest?.topResults as SeoKeywordDto["topResults"] | null) ?? [],
      lastCheckedAt: latest?.checkedAt.toISOString() ?? null,
      history: [...k.checks]
        .reverse()
        .map((c) => ({
          date: c.checkedAt.toISOString(),
          position: c.position,
        })),
    };
  });

  return {
    configured: dataForSeoConfigured(),
    keywords: dtos,
    maxKeywords: MAX_TRACKED_KEYWORDS,
  };
}

/** Tracked keywords with latest positions and history. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  return NextResponse.json(await buildRankingsDto(siteId));
}

/** Track new keywords. Runs an immediate rank check when DataForSEO is configured. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.keywords) ? body.keywords : [];
  const keywords = [
    ...new Set(
      raw
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length >= 2 && k.length <= 120)
    ),
  ];
  if (keywords.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one keyword." },
      { status: 400 }
    );
  }

  const existing = await prisma.seoKeyword.count({ where: { siteId } });
  const slots = MAX_TRACKED_KEYWORDS - existing;
  if (slots <= 0) {
    return NextResponse.json(
      { error: `You can track up to ${MAX_TRACKED_KEYWORDS} keywords per site.` },
      { status: 400 }
    );
  }

  for (const keyword of keywords.slice(0, slots)) {
    await prisma.seoKeyword.upsert({
      where: { siteId_keyword: { siteId, keyword } },
      update: {},
      create: { siteId, keyword },
    });
  }

  // First data point right away — each keyword is one DataForSEO task.
  if (dataForSeoConfigured()) {
    try {
      await runRankCheck(siteId);
    } catch (err) {
      console.error("[seo-rankings] initial check failed:", err);
    }
  }

  return NextResponse.json(await buildRankingsDto(siteId), { status: 201 });
}
