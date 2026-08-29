/** Pull a one-line preview from stored ad copy. Never invents fields. */
export function previewFromCopy(
  copy: unknown,
  platform: string
): { headline: string; body: string } {
  const c =
    copy && typeof copy === "object" ? (copy as Record<string, unknown>) : {};
  const headlines = Array.isArray(c.headlines)
    ? c.headlines.filter((h): h is string => typeof h === "string")
    : [];
  const descriptions = Array.isArray(c.descriptions)
    ? c.descriptions.filter((d): d is string => typeof d === "string")
    : [];

  if (platform === "GOOGLE") {
    return {
      headline: headlines[0] ?? "",
      body: descriptions[0] ?? "",
    };
  }
  if (platform === "META") {
    return {
      headline: headlines[0] ?? (typeof c.headline === "string" ? c.headline : ""),
      body: typeof c.primaryText === "string" ? c.primaryText : descriptions[0] ?? "",
    };
  }
  return {
    headline:
      (typeof c.headline === "string" && c.headline) ||
      (typeof c.prompt === "string" ? c.prompt : "") ||
      headlines[0] ||
      "",
    body:
      (typeof c.description === "string" && c.description) ||
      (typeof c.answer === "string" ? c.answer : "") ||
      descriptions[0] ||
      "",
  };
}

export function creativeUrl(creative: unknown): string | null {
  if (!creative || typeof creative !== "object") return null;
  const url = (creative as { url?: unknown }).url;
  return typeof url === "string" && url ? url : null;
}

export function audienceDescription(audience: unknown): string | null {
  if (!audience || typeof audience !== "object") return null;
  const description = (audience as { description?: unknown }).description;
  return typeof description === "string" && description.trim()
    ? description.trim()
    : null;
}

export function hasRealPerformance(metrics: {
  spendCents: number;
  impressions: number;
}): boolean {
  return metrics.impressions > 0 || metrics.spendCents > 0;
}

export function creativeAlt(creative: unknown): string | null {
  if (!creative || typeof creative !== "object") return null;
  const alt = (creative as { alt?: unknown }).alt;
  return typeof alt === "string" && alt ? alt : null;
}
