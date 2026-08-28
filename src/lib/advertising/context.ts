import { prisma } from "@/lib/db";
import {
  addMetrics,
  deriveMetrics,
  emptyTotals,
  lastNDays,
  type DerivedMetrics,
} from "@/lib/advertising/metrics";

export interface AssistantCampaign {
  id: string;
  name: string;
  platform: "GOOGLE" | "META" | "AI_CHAT";
  status: string;
  goal: string;
  budgetDailyCents: number | null;
  published: boolean;
  offeringName: string | null;
  siteHost: string | null;
  metrics: DerivedMetrics;
}

export interface AssistantOffering {
  id: string;
  name: string;
  kind: string;
  siteId: string;
  opportunityTitle: string | null;
}

export interface AssistantContext {
  campaigns: AssistantCampaign[];
  offerings: AssistantOffering[];
  connections: { google: boolean; meta: boolean };
  totals: DerivedMetrics;
  prompt: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Compact, grounded snapshot the assistant is allowed to talk about. */
export async function loadAssistantContext(userId: string): Promise<AssistantContext> {
  const { start } = lastNDays(30);

  const [campaignRows, connections, offeringRows] = await Promise.all([
    prisma.adCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        offering: { select: { name: true } },
        site: { select: { url: true } },
        metrics: {
          where: { date: { gte: start } },
          select: {
            spendCents: true,
            impressions: true,
            clicks: true,
            conversions: true,
            revenueCents: true,
          },
        },
      },
    }),
    prisma.adPlatformConnection.findMany({
      where: { userId, status: "CONNECTED", accountId: { not: null } },
      select: { platform: true },
    }),
    prisma.offering.findMany({
      where: { site: { userSites: { some: { userId } } } },
      take: 30,
      select: {
        id: true,
        name: true,
        kind: true,
        siteId: true,
        opportunities: {
          where: { dismissed: false },
          orderBy: { level: "asc" },
          take: 1,
          select: { title: true },
        },
      },
    }),
  ]);

  const campaigns: AssistantCampaign[] = campaignRows.map((c) => {
    const totals = c.metrics.reduce(
      (acc, m) => addMetrics(acc, m),
      emptyTotals()
    );
    return {
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      goal: c.goal,
      budgetDailyCents: c.budgetDailyCents,
      published: Boolean(c.externalId),
      offeringName: c.offering?.name ?? null,
      siteHost: c.site ? hostOf(c.site.url) : null,
      metrics: deriveMetrics(totals),
    };
  });

  const totals = deriveMetrics(
    campaigns.reduce((acc, c) => addMetrics(acc, c.metrics), emptyTotals())
  );

  const offerings: AssistantOffering[] = offeringRows.map((o) => ({
    id: o.id,
    name: o.name,
    kind: o.kind,
    siteId: o.siteId,
    opportunityTitle: o.opportunities[0]?.title ?? null,
  }));

  const google = connections.some((c) => c.platform === "GOOGLE");
  const meta = connections.some((c) => c.platform === "META");

  const money = (cents: number | null) =>
    cents == null ? "n/a" : `$${(cents / 100).toFixed(2)}`;

  const campaignLines = campaigns.map((c) => {
    const m = c.metrics;
    return `- id=${c.id} "${c.name}" ${c.platform} ${c.status} published=${c.published} budget/day=${money(c.budgetDailyCents)} offering=${c.offeringName ?? "n/a"} spend=${money(m.spendCents)} clicks=${m.clicks} conv=${m.conversions} cpa=${money(m.cpaCents)}`;
  });

  const offeringLines = offerings.slice(0, 16).map((o) => {
    const advertised = campaigns.some((c) => c.offeringName === o.name);
    return `- id=${o.id} "${o.name}" (${o.kind}) advertised=${advertised} opportunity=${o.opportunityTitle ?? "n/a"}`;
  });

  const prompt = [
    "ADVERTISING CONTEXT (authoritative — do not invent anything else):",
    `CONNECTIONS: Google=${google ? "connected" : "not connected"} Meta=${meta ? "connected" : "not connected"}`,
    `LAST 30 DAYS TOTALS: spend=${money(totals.spendCents)} impressions=${totals.impressions} clicks=${totals.clicks} conversions=${totals.conversions} revenue=${money(totals.revenueCents)}`,
    "CAMPAIGNS:",
    campaignLines.length > 0 ? campaignLines.join("\n") : "- none",
    "OFFERINGS (products/services from the website):",
    offeringLines.length > 0 ? offeringLines.join("\n") : "- none",
  ].join("\n");

  return {
    campaigns,
    offerings,
    connections: { google, meta },
    totals,
    prompt,
  };
}
