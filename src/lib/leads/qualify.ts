/**
 * Outreach-need threshold (100 − GEO score). Default 40 means qualify when
 * estimated GEO is below 60 — the same failing range as a GEO Archer Grade D/F.
 */
export function qualifyThreshold(): number {
  const n = Number(process.env["LEADGEN_QUALIFY_THRESHOLD"]);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.floor(n) : 40;
}
