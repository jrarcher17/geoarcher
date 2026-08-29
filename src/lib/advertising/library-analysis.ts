import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  MESSAGING_ANGLES,
  type LibraryAdAnalysis,
} from "@/lib/advertising/intelligence-providers/types";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

const analysisSchema = z.object({
  hook: z.string().nullable(),
  problem: z.string().nullable(),
  promise: z.string().nullable(),
  offer: z.string().nullable(),
  audience: z.string().nullable(),
  creativeStrategy: z.string().nullable(),
  cta: z.string().nullable(),
  messagingAngle: z.enum(MESSAGING_ANGLES),
  strengthScore: z.number().int().min(0).max(100),
  opportunityScore: z.number().int().min(0).max(100),
  strengthRationale: z.string(),
  opportunityRationale: z.string(),
  missing: z.array(z.string()),
});

const SYSTEM = `You analyze one advertisement using only fields returned by an official ad library.

Grounding rules (critical):
- Use ONLY the fields provided. If a field is missing or empty, set the matching analysis field to null.
- Do not invent headlines, offers, prices, dates, spend, impressions, clicks, conversions, or performance.
- Hook, Problem, Promise, Offer, Audience, and CTA must be grounded in the provided copy — quote or closely paraphrase.
- Creative Strategy: if there is no creative URL or format, say you only have text. Do not describe imagery you cannot see.
- Strength Score and Opportunity Score are AI recommendations about the copy — NOT measured performance, spend, or results.
- missing: name analysis fields you left null because the source ad did not contain enough evidence.
- messagingAngle: pick the single closest allowed angle.
- Do not claim the advertiser is running this ad now, or that it is winning.`;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to analyze stored library ads."
    );
  }
  return new OpenAI();
}

export function hasAnalyzableCopy(ad: {
  headline: string | null;
  primaryText: string | null;
}): boolean {
  return Boolean(ad.headline?.trim() || ad.primaryText?.trim());
}

export function parseAnalysis(value: unknown): LibraryAdAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.strengthScore !== "number" && typeof row.opportunityScore !== "number") {
    return null;
  }
  const angle = MESSAGING_ANGLES.includes(row.messagingAngle as LibraryAdAnalysis["messagingAngle"])
    ? (row.messagingAngle as LibraryAdAnalysis["messagingAngle"])
    : "Performance";
  return {
    label: "AI Recommendation",
    hook: typeof row.hook === "string" ? row.hook : null,
    problem: typeof row.problem === "string" ? row.problem : null,
    promise: typeof row.promise === "string" ? row.promise : null,
    offer: typeof row.offer === "string" ? row.offer : null,
    audience: typeof row.audience === "string" ? row.audience : null,
    creativeStrategy:
      typeof row.creativeStrategy === "string" ? row.creativeStrategy : null,
    cta: typeof row.cta === "string" ? row.cta : null,
    messagingAngle: angle,
    strengthScore: clampScore(row.strengthScore),
    opportunityScore: clampScore(row.opportunityScore),
    strengthRationale:
      typeof row.strengthRationale === "string" ? row.strengthRationale : "",
    opportunityRationale:
      typeof row.opportunityRationale === "string" ? row.opportunityRationale : "",
    missing: Array.isArray(row.missing) ? row.missing.map(String) : [],
    groundedFields: Array.isArray(row.groundedFields)
      ? row.groundedFields.map(String)
      : [],
  };
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function groundedFields(ad: {
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  landingPage: string | null;
  creativeUrl: string | null;
  format: string | null;
  advertiserName: string | null;
}): string[] {
  const fields: string[] = [];
  if (ad.headline?.trim()) fields.push("headline");
  if (ad.primaryText?.trim()) fields.push("primaryText");
  if (ad.cta?.trim()) fields.push("cta");
  if (ad.landingPage?.trim()) fields.push("landingPage");
  if (ad.creativeUrl?.trim()) fields.push("creativeUrl");
  if (ad.format?.trim()) fields.push("format");
  if (ad.advertiserName?.trim()) fields.push("advertiserName");
  return fields;
}

function adContextBlock(ad: {
  platform: string;
  advertiserName: string | null;
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  landingPage: string | null;
  creativeUrl: string | null;
  format: string | null;
  firstSeen: Date | null;
  lastSeen: Date | null;
  publisherPlatforms: unknown;
}): string {
  const platforms = Array.isArray(ad.publisherPlatforms)
    ? ad.publisherPlatforms.map(String).join(", ")
    : "";
  return [
    `PLATFORM: ${ad.platform}`,
    `ADVERTISER: ${ad.advertiserName ?? "(not named)"}`,
    `HEADLINE: ${ad.headline?.trim() || "(none)"}`,
    `PRIMARY TEXT: ${ad.primaryText?.trim() || "(none)"}`,
    `CTA: ${ad.cta?.trim() || "(none)"}`,
    `LANDING PAGE: ${ad.landingPage?.trim() || "(none)"}`,
    `FORMAT: ${ad.format?.trim() || "(none)"}`,
    `CREATIVE URL PRESENT: ${ad.creativeUrl?.trim() ? "yes" : "no"}`,
    `PUBLISHERS: ${platforms || "(none)"}`,
    `FIRST SEEN: ${ad.firstSeen ? ad.firstSeen.toISOString().slice(0, 10) : "(none)"}`,
    `LAST SEEN: ${ad.lastSeen ? ad.lastSeen.toISOString().slice(0, 10) : "(none)"}`,
  ].join("\n");
}

export async function analyzeLibraryAd(adId: string): Promise<{
  analysis: LibraryAdAnalysis | null;
  error?: string;
}> {
  const ad = await prisma.libraryAd.findUnique({ where: { id: adId } });
  if (!ad) return { analysis: null, error: "Library ad not found." };
  if (!hasAnalyzableCopy(ad)) {
    return {
      analysis: null,
      error: "This stored ad has no headline or body copy to analyze.",
    };
  }

  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const grounded = groundedFields(ad);

  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: SYSTEM },
      { role: "user", content: adContextBlock(ad) },
    ],
    text: { format: zodTextFormat(analysisSchema, "library_ad_analysis") },
  });

  const parsed = res.output_parsed;
  if (!parsed) {
    return { analysis: null, error: "The model returned no analysis." };
  }

  const analysis: LibraryAdAnalysis = {
    ...parsed,
    label: "AI Recommendation",
    strengthScore: clampScore(parsed.strengthScore),
    opportunityScore: clampScore(parsed.opportunityScore),
    groundedFields: grounded,
  };

  await prisma.libraryAd.update({
    where: { id: ad.id },
    data: {
      analysis: asJson(analysis),
      analyzedAt: new Date(),
    },
  });

  return { analysis };
}

const BATCH_CAP = 8;

/** Analyze stored ads that still lack analysis. Never invents ads. */
export async function analyzeStoredLibraryAds(input: {
  siteIds: string[];
  adId?: string;
  offeringId?: string;
  competitorId?: string;
  force?: boolean;
}): Promise<{
  analyzed: number;
  skipped: number;
  error?: string;
}> {
  if (input.adId) {
    const ad = await prisma.libraryAd.findFirst({
      where: { id: input.adId, siteId: { in: input.siteIds } },
    });
    if (!ad) return { analyzed: 0, skipped: 0, error: "Library ad not found." };
    const result = await analyzeLibraryAd(ad.id);
    if (result.error) return { analyzed: 0, skipped: 1, error: result.error };
    return { analyzed: 1, skipped: 0 };
  }

  const where = {
    siteId: { in: input.siteIds },
    ...(input.offeringId ? { offeringId: input.offeringId } : {}),
    ...(input.competitorId ? { competitorId: input.competitorId } : {}),
    ...(input.force ? {} : { analyzedAt: null }),
  };

  const ads = await prisma.libraryAd.findMany({
    where,
    orderBy: { fetchedAt: "desc" },
    take: BATCH_CAP,
    select: { id: true, headline: true, primaryText: true },
  });

  if (ads.length === 0) {
    return {
      analyzed: 0,
      skipped: 0,
      error: "No stored library ads to analyze. Search an official library first.",
    };
  }

  let analyzed = 0;
  let skipped = 0;
  let lastError: string | undefined;

  for (const ad of ads) {
    if (!hasAnalyzableCopy(ad)) {
      skipped += 1;
      continue;
    }
    try {
      const result = await analyzeLibraryAd(ad.id);
      if (result.analysis) analyzed += 1;
      else {
        skipped += 1;
        lastError = result.error;
      }
    } catch (err) {
      skipped += 1;
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (analyzed === 0 && lastError) {
    return { analyzed, skipped, error: lastError };
  }

  return { analyzed, skipped };
}
