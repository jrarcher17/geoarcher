export interface MetricTotals {
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenueCents: number;
}

export interface DerivedMetrics extends MetricTotals {
  ctr: number | null;
  cpcCents: number | null;
  cpaCents: number | null;
  roas: number | null;
}

export const emptyTotals = (): MetricTotals => ({
  spendCents: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  revenueCents: 0,
});

export function addMetrics(a: MetricTotals, b: MetricTotals): MetricTotals {
  return {
    spendCents: a.spendCents + b.spendCents,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
    revenueCents: a.revenueCents + b.revenueCents,
  };
}

export function deriveMetrics(t: MetricTotals): DerivedMetrics {
  return {
    ...t,
    ctr: t.impressions > 0 ? t.clicks / t.impressions : null,
    cpcCents: t.clicks > 0 ? Math.round(t.spendCents / t.clicks) : null,
    cpaCents: t.conversions > 0 ? Math.round(t.spendCents / t.conversions) : null,
    roas: t.spendCents > 0 ? t.revenueCents / t.spendCents : null,
  };
}

export function hasActivity(t: MetricTotals): boolean {
  return t.spendCents > 0 || t.impressions > 0 || t.clicks > 0 || t.conversions > 0;
}

/** UTC calendar date as YYYY-MM-DD. */
export function dateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Inclusive UTC window of the last `days` calendar days, ending today. */
export function lastNDays(days: number): { start: Date; end: Date; keys: string[] } {
  const n = Math.min(Math.max(Math.round(days), 1), 365);
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (n - 1));
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    keys.push(dateKey(d));
  }
  return { start, end, keys };
}

export interface DailyRow extends MetricTotals {
  date: string;
}

/** One point per calendar day; missing days are zeros so charts have a continuous axis. */
export function fillDailySeries(
  keys: string[],
  rows: Array<MetricTotals & { date: Date | string }>
): DailyRow[] {
  const byDay = new Map<string, MetricTotals>();
  for (const key of keys) byDay.set(key, emptyTotals());
  for (const row of rows) {
    const key = dateKey(row.date);
    const prev = byDay.get(key);
    if (!prev) continue;
    byDay.set(key, addMetrics(prev, row));
  }
  return keys.map((date) => ({ date, ...byDay.get(date)! }));
}

export function groupBy<K extends string>(
  rows: Array<MetricTotals & { key: K }>
): Map<K, MetricTotals> {
  const map = new Map<K, MetricTotals>();
  for (const row of rows) {
    map.set(row.key, addMetrics(map.get(row.key) ?? emptyTotals(), row));
  }
  return map;
}

export type InsightTone = "positive" | "watch" | "neutral";

export interface PerformanceNote {
  title: string;
  detail: string;
  tone: InsightTone;
}

/**
 * Deterministic observations from real totals only. Returns [] when there is
 * no activity — never invents spend, conversions or causes.
 */
export function performanceNotes(
  totals: DerivedMetrics,
  platforms: Array<{ platform: string } & DerivedMetrics>,
  daily: DailyRow[]
): PerformanceNote[] {
  if (!hasActivity(totals)) return [];

  const notes: PerformanceNote[] = [];
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  if (totals.conversions > 0 && totals.cpaCents != null) {
    notes.push({
      title: "Cost per conversion",
      detail: `${totals.conversions} conversion${totals.conversions === 1 ? "" : "s"} at ${money(totals.cpaCents)} each on ${money(totals.spendCents)} spend.`,
      tone: "neutral",
    });
  } else if (totals.clicks > 0 && totals.conversions === 0) {
    notes.push({
      title: "Clicks without conversions",
      detail: `${totals.clicks} click${totals.clicks === 1 ? "" : "s"} and no conversions in this window. Spend is ${money(totals.spendCents)}.`,
      tone: "watch",
    });
  } else if (totals.impressions > 0 && totals.clicks === 0) {
    notes.push({
      title: "Impressions without clicks",
      detail: `${totals.impressions} impression${totals.impressions === 1 ? "" : "s"} and no clicks yet.`,
      tone: "watch",
    });
  }

  if (totals.ctr != null) {
    notes.push({
      title: "Click-through rate",
      detail: `${(totals.ctr * 100).toFixed(2)}% CTR (${totals.clicks} clicks / ${totals.impressions} impressions).`,
      tone: totals.ctr >= 0.02 ? "positive" : "neutral",
    });
  }

  if (totals.roas != null) {
    notes.push({
      title: "Return on ad spend",
      detail: `${totals.roas.toFixed(2)}x ROAS on ${money(totals.spendCents)} spend.`,
      tone: totals.roas >= 1 ? "positive" : "watch",
    });
  }

  const activePlatforms = platforms.filter((p) => hasActivity(p));
  if (activePlatforms.length >= 2 && totals.spendCents > 0) {
    const ranked = [...activePlatforms].sort((a, b) => b.spendCents - a.spendCents);
    const top = ranked[0];
    const share = Math.round((top.spendCents / totals.spendCents) * 100);
    notes.push({
      title: "Platform mix",
      detail: `${top.platform === "GOOGLE" ? "Google" : top.platform === "META" ? "Meta" : top.platform} is ${share}% of spend (${money(top.spendCents)}).`,
      tone: "neutral",
    });
  }

  const peak = daily.reduce<(DailyRow & { spendCents: number }) | null>((best, day) => {
    if (!best || day.spendCents > best.spendCents) return day;
    return best;
  }, null);
  if (peak && peak.spendCents > 0) {
    notes.push({
      title: "Highest-spend day",
      detail: `${peak.date}: ${money(peak.spendCents)} spend, ${peak.conversions} conversion${peak.conversions === 1 ? "" : "s"}.`,
      tone: "neutral",
    });
  }

  return notes.slice(0, 6);
}
