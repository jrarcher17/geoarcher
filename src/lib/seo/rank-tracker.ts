import { prisma } from "@/lib/db";
import { checkKeywordRankings } from "./dataforseo";

export const MAX_TRACKED_KEYWORDS = 25;

/**
 * Check current Google positions for all of a site's tracked keywords and
 * store one SeoRankCheck snapshot per keyword. Returns the number checked.
 * Each keyword is a paid DataForSEO task — callers decide when to run this.
 */
export async function runRankCheck(siteId: string): Promise<number> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { url: true },
  });
  if (!site) throw new Error("Site not found.");

  const keywords = await prisma.seoKeyword.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    take: MAX_TRACKED_KEYWORDS,
  });
  if (keywords.length === 0) return 0;

  const targetDomain = new URL(site.url).hostname;
  const results = await checkKeywordRankings(
    keywords.map((k) => ({
      keyword: k.keyword,
      locationCode: k.locationCode,
      languageCode: k.languageCode,
    })),
    targetDomain
  );

  const byKeyword = new Map(results.map((r) => [r.keyword.toLowerCase(), r]));
  let stored = 0;
  for (const k of keywords) {
    const result = byKeyword.get(k.keyword.toLowerCase());
    if (!result || result.error) continue;
    await prisma.seoRankCheck.create({
      data: {
        keywordId: k.id,
        position: result.position,
        url: result.url,
        topResults: JSON.parse(JSON.stringify(result.topResults)),
      },
    });
    stored += 1;
  }
  return stored;
}

/** Latest check timestamp across a site's keywords, or null if never checked. */
export async function lastRankCheckAt(siteId: string): Promise<Date | null> {
  const latest = await prisma.seoRankCheck.findFirst({
    where: { keyword: { siteId } },
    orderBy: { checkedAt: "desc" },
    select: { checkedAt: true },
  });
  return latest?.checkedAt ?? null;
}
