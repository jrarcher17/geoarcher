export interface RankableImage {
  id: string;
  url: string;
  alt: string | null;
  pageUrl?: string | null;
  offeringId?: string | null;
}

function tokensFromName(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function haystack(img: RankableImage): string {
  return `${img.alt ?? ""} ${img.url} ${img.pageUrl ?? ""}`.toLowerCase();
}

function normalizePage(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Higher score = more likely this photo is the product being advertised. */
export function imageRelevance(
  img: RankableImage,
  offering: { id: string; name: string; url?: string | null }
): number {
  let score = 0;
  if (img.offeringId === offering.id) score += 50;
  if (
    offering.url &&
    img.pageUrl &&
    normalizePage(img.pageUrl) === normalizePage(offering.url)
  ) {
    score += 40;
  }
  const hay = haystack(img);
  for (const token of tokensFromName(offering.name)) {
    if (hay.includes(token)) score += token.length > 5 ? 18 : 10;
  }
  return score;
}

export function rankImagesForOffering<T extends RankableImage>(
  images: T[],
  offering: { id: string; name: string; url?: string | null }
): T[] {
  return [...images].sort((a, b) => {
    const diff = imageRelevance(b, offering) - imageRelevance(a, offering);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}
