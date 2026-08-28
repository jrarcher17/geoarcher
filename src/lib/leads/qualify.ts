export {
  hasAdvertisingOpportunity,
  type SiteCheckFacts,
} from "./ad-opportunity";

/**
 * Outreach-need threshold (100 − GEO score). Kept as supporting data —
 * qualification is now advertising-opportunity, not a GEO gap.
 */
export function qualifyThreshold(): number {
  const n = Number(process.env["LEADGEN_QUALIFY_THRESHOLD"]);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.floor(n) : 40;
}

/** GEO at or above this is treated as already healthy. Default 60. */
export function geoHealthyAt(): number {
  return 100 - qualifyThreshold();
}

/** A 59 F is below 60 — it needs help. 60+ is skipped. */
export function needsGeoHelp(geoScore: number): boolean {
  return geoScore < geoHealthyAt();
}
