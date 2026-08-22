/** Prospects scoring at or above this become QUALIFIED (email reveal + outreach). */
export function qualifyThreshold(): number {
  const n = Number(process.env["LEADGEN_QUALIFY_THRESHOLD"]);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.floor(n) : 40;
}
