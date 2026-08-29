import type { CompetitorGapDetails } from "@/lib/advertising/types";

export function parseGapDetails(value: unknown): CompetitorGapDetails | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.opportunityScore !== "number" && typeof row.recommendedAngle !== "string") {
    return null;
  }
  return {
    label: "AI Recommendation",
    focusedOn: Array.isArray(row.focusedOn) ? row.focusedOn.map(String) : [],
    missing: Array.isArray(row.missing) ? row.missing.map(String) : [],
    recommendedAngle:
      typeof row.recommendedAngle === "string" ? row.recommendedAngle : "",
    opportunityScore:
      typeof row.opportunityScore === "number" ? row.opportunityScore : 0,
    groundedAdCount:
      typeof row.groundedAdCount === "number" ? row.groundedAdCount : 0,
    advertiserNames: Array.isArray(row.advertiserNames)
      ? row.advertiserNames.map(String)
      : [],
  };
}

export function toOpportunityDto(o: {
  id: string;
  title: string;
  level: string;
  rationale: string;
  channels: unknown;
  source?: string;
  site: { id: string; url: string };
  offering: { id: string; name: string; kind: string } | null;
}) {
  return {
    id: o.id,
    title: o.title,
    level: o.level,
    rationale: o.rationale,
    channels: o.channels,
    source: o.source ?? "SITE",
    siteId: o.site.id,
    siteUrl: o.site.url,
    offering: o.offering,
  };
}
