import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { parseAnalysis } from "@/lib/advertising/library-analysis";
import { MESSAGING_ANGLES } from "@/lib/advertising/intelligence-providers/types";
import type {
  AdIntelligenceScore,
  BusinessProfile,
  CompetitorGapDetails,
  MarketingAssets,
  OfferingDetails,
} from "@/lib/advertising/types";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

export const MIN_ANALYZED_FOR_GAPS = 2;
const MAX_ADS_IN_PROMPT = 24;

const gapSchema = z.object({
  opportunities: z.array(
    z.object({
      title: z.string(),
      offeringName: z.string().nullable(),
      level: z.enum(["HIGH", "MEDIUM", "LOW"]),
      focusedOn: z.array(z.string()),
      missing: z.array(z.string()),
      recommendedAngle: z.string(),
      opportunityScore: z.number().int().min(0).max(100),
      rationale: z.string(),
      channels: z.array(z.enum(["google", "meta", "ai"])),
    })
  ),
});

const SYSTEM = `You find advertising gaps by comparing analyzed official-library ads with the user's product intelligence.

Grounding rules (critical):
- Use ONLY the analyzed ads and site facts provided. Do not invent ads, advertisers, spend, dates, or performance.
- focusedOn must be patterns actually present in the provided analyses (angles, hooks, problems, offers).
- missing and recommendedAngle must be something the user's site can support from the provided offerings or marketing.
- Do not claim an angle is unused industry-wide — only that it is rare or absent in this stored set.
- opportunityScore is an AI recommendation, not measured performance.
- 2–5 opportunities. Prefer fewer accurate gaps. Return an empty list if the analyses are too thin.
- offeringName must match a provided offering exactly, or be null.`;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to find competitor-gap opportunities."
    );
  }
  return new OpenAI();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeAdIntelligenceScore(input: {
  analyzed: Array<{
    analysis: NonNullable<ReturnType<typeof parseAnalysis>>;
    creativeUrl: string | null;
    advertiserName: string | null;
  }>;
  competitorCount: number;
}): AdIntelligenceScore | null {
  if (input.analyzed.length < MIN_ANALYZED_FOR_GAPS) return null;

  const advertisers = new Set(
    input.analyzed.map((a) => a.advertiserName?.trim()).filter(Boolean)
  );
  const competitorCoverage =
    input.competitorCount > 0
      ? clampScore((advertisers.size / input.competitorCount) * 100)
      : clampScore(advertisers.size * 20);

  const usedAngles = new Set(input.analyzed.map((a) => a.analysis.messagingAngle));
  const messagingOpportunity = clampScore(
    ((MESSAGING_ANGLES.length - usedAngles.size) / MESSAGING_ANGLES.length) * 100
  );

  const n = input.analyzed.length;
  const creativeOpportunity = clampScore(
    (input.analyzed.filter((a) => !a.creativeUrl?.trim()).length / n) * 100
  );
  const offerOpportunity = clampScore(
    (input.analyzed.filter((a) => !a.analysis.offer).length / n) * 100
  );
  const audienceOpportunity = clampScore(
    (input.analyzed.filter((a) => !a.analysis.audience).length / n) * 100
  );

  const breakdown = {
    competitorCoverage,
    messagingOpportunity,
    creativeOpportunity,
    offerOpportunity,
    audienceOpportunity,
  };
  const overall = clampScore(
    (competitorCoverage +
      messagingOpportunity +
      creativeOpportunity +
      offerOpportunity +
      audienceOpportunity) /
      5
  );

  return {
    label: "AI Recommendation",
    overall,
    breakdown,
    groundedAdCount: n,
    advertiserCount: advertisers.size,
  };
}

function contextBlock(input: {
  business: BusinessProfile | null;
  marketing: MarketingAssets | null;
  offerings: { name: string; description: string | null; details: OfferingDetails | null }[];
  ads: Array<{
    advertiserName: string | null;
    headline: string | null;
    analysis: NonNullable<ReturnType<typeof parseAnalysis>>;
  }>;
}): string {
  const offerings = input.offerings
    .map((o) => {
      const audience = o.details?.targetAudience?.join(", ") || "";
      return `- ${o.name}${o.description ? `: ${o.description.slice(0, 180)}` : ""}${
        audience ? ` [audience: ${audience}]` : ""
      }`;
    })
    .join("\n");
  const usps = input.marketing?.usps?.slice(0, 6).join(" · ") || "(none)";
  const headlines = input.marketing?.headlines?.slice(0, 6).join(" · ") || "(none)";
  const ads = input.ads
    .map((ad, i) => {
      const a = ad.analysis;
      return [
        `${i + 1}. advertiser=${ad.advertiserName ?? "(unnamed)"} headline=${ad.headline ?? "(none)"}`,
        `   angle=${a.messagingAngle} hook=${a.hook ?? "(none)"} problem=${a.problem ?? "(none)"}`,
        `   promise=${a.promise ?? "(none)"} offer=${a.offer ?? "(none)"} audience=${a.audience ?? "(none)"}`,
        `   cta=${a.cta ?? "(none)"}`,
      ].join("\n");
    })
    .join("\n");

  return [
    `COMPANY: ${input.business?.companyName ?? "(unknown)"}`,
    `INDUSTRY: ${input.business?.industry ?? "(unknown)"}`,
    `DESCRIPTION: ${input.business?.description ?? "(none)"}`,
    `SITE HEADLINES: ${headlines}`,
    `SITE USPS: ${usps}`,
    `OFFERINGS:\n${offerings || "(none)"}`,
    `ANALYZED LIBRARY ADS (${input.ads.length}):`,
    ads,
  ].join("\n");
}

/** Competitor-gap opportunities from stored library analyses. Never invents ads. */
export async function findCompetitorGaps(siteId: string): Promise<{
  created: number;
  analyzedCount: number;
  error?: string;
}> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      intelligence: true,
      offerings: { orderBy: { name: "asc" } },
      _count: { select: { adCompetitors: { where: { dismissed: false } } } },
    },
  });
  if (!site) return { created: 0, analyzedCount: 0, error: "Site not found." };

  const stored = await prisma.libraryAd.findMany({
    where: { siteId, analyzedAt: { not: null } },
    orderBy: { analyzedAt: "desc" },
    take: MAX_ADS_IN_PROMPT,
  });

  const ads = stored
    .map((row) => {
      const analysis = parseAnalysis(row.analysis);
      return analysis
        ? {
            advertiserName: row.advertiserName,
            headline: row.headline,
            creativeUrl: row.creativeUrl,
            analysis,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (ads.length < MIN_ANALYZED_FOR_GAPS) {
    return {
      created: 0,
      analyzedCount: ads.length,
      error:
        ads.length === 0
          ? "Analyze stored library ads first. Gaps are found from those analyses — not invented."
          : `Need at least ${MIN_ANALYZED_FOR_GAPS} analyzed library ads to compare. ${ads.length} analyzed so far.`,
    };
  }

  const business = (site.intelligence?.business ?? null) as BusinessProfile | null;
  const marketing = (site.intelligence?.marketing ?? null) as MarketingAssets | null;
  const offerings = site.offerings.map((o) => ({
    name: o.name,
    description: o.description,
    details: (o.details ?? null) as unknown as OfferingDetails | null,
  }));

  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: contextBlock({
          business,
          marketing,
          offerings,
          ads: ads.map((a) => ({
            advertiserName: a.advertiserName,
            headline: a.headline,
            analysis: a.analysis,
          })),
        }),
      },
    ],
    text: { format: zodTextFormat(gapSchema, "competitor_gaps") },
  });

  const parsed = res.output_parsed?.opportunities ?? [];
  if (parsed.length === 0) {
    return {
      created: 0,
      analyzedCount: ads.length,
      error:
        "No clear gaps in this analyzed set. Analyze more library ads, then try again.",
    };
  }

  const offeringIdByName = new Map(site.offerings.map((o) => [o.name, o.id]));
  const advertiserNames = [
    ...new Set(ads.map((a) => a.advertiserName?.trim()).filter(Boolean) as string[]),
  ];

  const dismissed = await prisma.adOpportunity.findMany({
    where: { siteId, dismissed: true, source: "COMPETITOR_GAP" },
    select: { title: true },
  });
  const dismissedTitles = new Set(dismissed.map((d) => d.title));

  await prisma.adOpportunity.deleteMany({
    where: { siteId, dismissed: false, source: "COMPETITOR_GAP" },
  });

  let created = 0;
  for (const opp of parsed) {
    if (dismissedTitles.has(opp.title)) continue;
    const details: CompetitorGapDetails = {
      label: "AI Recommendation",
      focusedOn: opp.focusedOn,
      missing: opp.missing,
      recommendedAngle: opp.recommendedAngle,
      opportunityScore: clampScore(opp.opportunityScore),
      groundedAdCount: ads.length,
      advertiserNames,
    };
    await prisma.adOpportunity.create({
      data: {
        siteId,
        source: "COMPETITOR_GAP",
        offeringId: opp.offeringName
          ? offeringIdByName.get(opp.offeringName) ?? null
          : null,
        title: opp.title,
        level: opp.level,
        rationale: opp.rationale,
        channels: asJson(opp.channels),
        recommendedCampaign: asJson({
          name: opp.title,
          goal: "TRAFFIC",
          audience: opp.missing[0] ?? opp.recommendedAngle,
          budgetHint: "AI recommendation — not a measured budget",
        }),
        details: asJson(details),
      },
    });
    created += 1;
  }

  return { created, analyzedCount: ads.length };
}

export async function scoreForSites(siteIds: string[]): Promise<AdIntelligenceScore | null> {
  if (siteIds.length === 0) return null;
  const [rows, competitorCount] = await Promise.all([
    prisma.libraryAd.findMany({
      where: { siteId: { in: siteIds }, analyzedAt: { not: null } },
      select: { analysis: true, creativeUrl: true, advertiserName: true },
      take: 80,
    }),
    prisma.adCompetitor.count({
      where: { siteId: { in: siteIds }, dismissed: false },
    }),
  ]);
  const analyzed = rows
    .map((row) => {
      const analysis = parseAnalysis(row.analysis);
      return analysis
        ? {
            analysis,
            creativeUrl: row.creativeUrl,
            advertiserName: row.advertiserName,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  return computeAdIntelligenceScore({ analyzed, competitorCount });
}
