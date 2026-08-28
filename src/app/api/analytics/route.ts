import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { analyzePerformance } from "@/lib/advertising/analyze";
import {
  addMetrics,
  deriveMetrics,
  emptyTotals,
  fillDailySeries,
  hasActivity,
  lastNDays,
  performanceNotes,
  type MetricTotals,
} from "@/lib/advertising/metrics";

const PLATFORMS = ["GOOGLE", "META", "AI_CHAT"] as const;
type Platform = (typeof PLATFORMS)[number];

function parseDays(raw: string | null): number {
  const n = Number(raw);
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

/**
 * Aggregated advertising performance for the signed-in user.
 * Only real CampaignMetric rows — zeros stay zeros, nothing is simulated.
 *
 * `insights=ai` runs a grounded model pass; default is deterministic notes.
 */
export async function GET(request: NextRequest) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const { searchParams } = request.nextUrl;
  const days = parseDays(searchParams.get("days"));
  const siteId = searchParams.get("site");
  const platformRaw = searchParams.get("platform");
  const platform =
    platformRaw && PLATFORMS.includes(platformRaw as Platform)
      ? (platformRaw as Platform)
      : null;
  const wantAi = searchParams.get("insights") === "ai";

  const { start, end, keys } = lastNDays(days);

  const campaignWhere = {
    userId: access.userId,
    ...(siteId ? { siteId } : {}),
    ...(platform ? { platform } : {}),
  };

  const [metricRows, campaigns, connections] = await Promise.all([
    prisma.campaignMetric.findMany({
      where: {
        date: { gte: start, lte: end },
        campaign: campaignWhere,
      },
      select: {
        date: true,
        spendCents: true,
        impressions: true,
        clicks: true,
        conversions: true,
        revenueCents: true,
        campaign: { select: { id: true, platform: true } },
      },
    }),
    prisma.adCampaign.findMany({
      where: campaignWhere,
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
        site: { select: { id: true, url: true } },
        offering: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.adPlatformConnection.findMany({
      where: { userId: access.userId },
      select: { platform: true, status: true, accountName: true },
    }),
  ]);

  const totals = metricRows.reduce<MetricTotals>(
    (acc, row) => addMetrics(acc, row),
    emptyTotals()
  );
  const derived = deriveMetrics(totals);

  const daily = fillDailySeries(keys, metricRows);

  const byPlatform = new Map<string, MetricTotals>();
  for (const p of ["GOOGLE", "META"] as const) byPlatform.set(p, emptyTotals());
  for (const row of metricRows) {
    const key = row.campaign.platform;
    byPlatform.set(key, addMetrics(byPlatform.get(key) ?? emptyTotals(), row));
  }
  const platforms = [...byPlatform.entries()].map(([p, t]) => ({
    platform: p,
    ...deriveMetrics(t),
  }));

  const byCampaign = new Map<string, MetricTotals>();
  for (const row of metricRows) {
    byCampaign.set(
      row.campaign.id,
      addMetrics(byCampaign.get(row.campaign.id) ?? emptyTotals(), row)
    );
  }
  const campaignRows = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    platform: c.platform,
    status: c.status,
    site: c.site,
    offering: c.offering,
    ...deriveMetrics(byCampaign.get(c.id) ?? emptyTotals()),
  }));

  const notes = wantAi
    ? await analyzePerformance(derived, platforms, daily)
    : performanceNotes(derived, platforms, daily);

  const google = connections.find((c) => c.platform === "GOOGLE");
  const meta = connections.find((c) => c.platform === "META");

  return NextResponse.json({
    range: {
      days,
      start: keys[0],
      end: keys[keys.length - 1],
    },
    hasData: hasActivity(totals),
    totals: derived,
    daily,
    platforms,
    campaigns: campaignRows,
    notes,
    connections: {
      google: {
        connected: google?.status === "CONNECTED",
        accountName: google?.accountName ?? null,
      },
      meta: {
        connected: meta?.status === "CONNECTED",
        accountName: meta?.accountName ?? null,
      },
    },
  });
}
