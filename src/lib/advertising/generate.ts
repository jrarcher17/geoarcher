import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type {
  BusinessProfile,
  CompetitorGapDetails,
  MarketingAssets,
  OfferingDetails,
} from "@/lib/advertising/types";
import { parseAnalysis } from "@/lib/advertising/library-analysis";

// ---- Output schema (structured outputs; platform limits enforced after) ----

const pmaxConceptSchema = z.object({
  theme: z.string(),
  headlines: z.array(z.string()),
  descriptions: z.array(z.string()),
  audience: z.string(),
});

const googleAssetsSchema = z.object({
  adGroupName: z.string(),
  /// Up to 30 characters each
  headlines: z.array(z.string()),
  /// Up to 90 characters each
  descriptions: z.array(z.string()),
  keywords: z.array(z.string()),
  negativeKeywords: z.array(z.string()),
  /// RSA display path parts, 15 characters each
  path1: z.string(),
  path2: z.string(),
  pmaxConcepts: z.array(pmaxConceptSchema),
});

const META_CTAS = [
  "LEARN_MORE",
  "SIGN_UP",
  "GET_QUOTE",
  "CONTACT_US",
  "BOOK_NOW",
  "SHOP_NOW",
  "SUBSCRIBE",
  "GET_OFFER",
] as const;

const metaAssetsSchema = z.object({
  adSetName: z.string(),
  primaryText: z.string(),
  /// Up to 40 characters
  headline: z.string(),
  /// Up to 30 characters
  description: z.string(),
  cta: z.enum(META_CTAS),
});

const chatgptAssetsSchema = z.object({
  /// Brand name as it should appear on a sponsored recommendation.
  advertiser: z.string(),
  /// Up to 70 characters
  headline: z.string(),
  /// One or two sentences, up to 180 characters
  description: z.string(),
  /// A realistic buyer question this brand could answer.
  prompt: z.string(),
  /// Original recommended answer grounded in the site. Used as preview context, not the published chat_card body.
  answer: z.string(),
  followUp: z.string().nullable(),
  /// Intent / context concepts buyers would bring to ChatGPT
  intents: z.array(z.string()),
});

const generationSchema = z.object({
  google: googleAssetsSchema,
  meta: metaAssetsSchema,
  chatgpt: chatgptAssetsSchema,
  sellingPoints: z.array(z.string()),
  audienceRecommendation: z.string(),
});

export type GoogleAssets = z.infer<typeof googleAssetsSchema>;
export type MetaAssets = z.infer<typeof metaAssetsSchema>;
export type ChatgptAssets = z.infer<typeof chatgptAssetsSchema>;
export type GeneratedAdAssets = z.infer<typeof generationSchema>;

export const AD_TONES = [
  "Premium",
  "Direct Response",
  "Professional",
  "Friendly",
  "Bold",
  "Scientific",
  "Luxury",
  "Minimal",
] as const;
export type AdTone = (typeof AD_TONES)[number];

export interface CampaignBrief {
  name: string;
  goal: "LEADS" | "SALES" | "TRAFFIC" | "PHONE_CALLS" | "AWARENESS";
  objectiveNote?: string;
  landingPage: string;
  budgetDailyCents: number | null;
  location: string;
  audience: string;
  tone: AdTone;
  offer?: string;
  angle?: string;
  opportunityId?: string;
}

export interface GenerationGrounding {
  patternCount: number;
  opportunityTitle: string | null;
  opportunityAngle: string | null;
  tone: AdTone;
}

const SYSTEM_PROMPT = `You are a senior performance-marketing copywriter. Generate ORIGINAL advertising for one product/service.

Grounding rules (critical — violating them is a failure):
- Use only claims, prices, features, benefits, testimonials and promotions present in the website data. Do not invent guarantees, certifications, statistics, awards, discounts or medical claims.
- Mention price only if a price is provided. Mention an offer only if it is in the website data or the user-supplied offer field.
- Write in the requested tone. Specific and concrete — never generic filler like "best in town".
- Competitor patterns (if provided) are landscape signals only: angles, problems, promises. Do NOT copy competitor headlines, primary text, CTAs, or offers. Do not name competitors in the copy.
- If an advertising opportunity is provided, prefer that recommended angle. It is an AI recommendation, not measured performance.
- If no competitor patterns are provided, write only from the website. Do not invent a competitive landscape.

Google Ads (responsive search ad):
- 10-12 headlines, each 30 characters or fewer. Mix: offering name, benefit-led, location-led (if a target location is given), CTA-led.
- 4 descriptions, each 90 characters or fewer.
- 12-20 keywords a buyer would search, matching the offering and location. Lowercase, no punctuation.
- 6-12 negativeKeywords: off-intent terms (jobs, careers, login, free pirated, unrelated brands). Lowercase.
- path1 and path2: optional display-path slugs, 15 characters or fewer, from the offering name. Empty string if none fit.
- pmaxConcepts: 2-3 Performance Max *concepts* (theme, 3-5 short headlines, 1-2 descriptions, audience). These are planning concepts only — not live campaigns.
- adGroupName: short, offering-based.

Meta (Facebook/Instagram feed ad):
- primaryText: 1-3 short paragraphs, first line hooks the target audience's problem or desire. May include 1-2 tasteful emoji only if fitting for the brand.
- headline: 40 characters or fewer. description: 30 characters or fewer.
- cta: pick the best fit for the campaign goal.
- adSetName: short, audience-based.

ChatGPT advertising (OpenAI Ads API chat_card: title, body, target URL, optional image):
- advertiser: the company name as the website uses it.
- headline: 70 characters or fewer. Benefit-led, offering-specific.
- description: 1-2 sentences, 180 characters or fewer. Grounded product summary.
- intents: 6-10 short buyer-intent phrases (recovery, comparison, cost, how-to) from the site — not invented categories.
- prompt: a realistic buyer question this business can answer from the site facts.
- answer: 2-4 short paragraphs that could appear as a recommended/cited answer. Original. Grounded. Name the brand only as the site does.
- followUp: one suggested next question, or null.

Also return 3-6 sellingPoints (grounded) and a one-sentence audienceRecommendation refining the given audience.`;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to enable AI ad generation."
    );
  }
  return new OpenAI();
}

const dedupe = (list: string[]) => [...new Set(list.map((s) => s.trim()))].filter(Boolean);

function enforceLimits(assets: GeneratedAdAssets): GeneratedAdAssets {
  return {
    ...assets,
    google: {
      ...assets.google,
      headlines: dedupe(assets.google.headlines)
        .filter((h) => h.length <= 30)
        .slice(0, 15),
      descriptions: dedupe(assets.google.descriptions)
        .filter((d) => d.length <= 90)
        .slice(0, 4),
      keywords: dedupe(assets.google.keywords.map((k) => k.toLowerCase())).slice(0, 25),
      negativeKeywords: dedupe(
        (assets.google.negativeKeywords ?? []).map((k) => k.toLowerCase())
      ).slice(0, 20),
      path1: (assets.google.path1 ?? "").replace(/^\//, "").slice(0, 15),
      path2: (assets.google.path2 ?? "").replace(/^\//, "").slice(0, 15),
      pmaxConcepts: (assets.google.pmaxConcepts ?? []).slice(0, 3).map((c) => ({
        ...c,
        headlines: dedupe(c.headlines).filter((h) => h.length <= 30).slice(0, 5),
        descriptions: dedupe(c.descriptions).filter((d) => d.length <= 90).slice(0, 2),
      })),
    },
    meta: {
      ...assets.meta,
      headline: assets.meta.headline.slice(0, 40),
      description: assets.meta.description.slice(0, 30),
    },
    chatgpt: {
      advertiser: (assets.chatgpt.advertiser ?? "").trim().slice(0, 80),
      headline: (assets.chatgpt.headline ?? "").trim().slice(0, 70),
      description: (assets.chatgpt.description ?? "").trim().slice(0, 180),
      prompt: assets.chatgpt.prompt.trim(),
      answer: assets.chatgpt.answer.trim(),
      followUp: assets.chatgpt.followUp?.trim() || null,
      intents: dedupe(assets.chatgpt.intents ?? []).slice(0, 12),
    },
  };
}

async function loadCompetitorPatterns(siteId: string): Promise<string[]> {
  const rows = await prisma.libraryAd.findMany({
    where: { siteId, analyzedAt: { not: null } },
    orderBy: { analyzedAt: "desc" },
    take: 16,
    select: { analysis: true },
  });
  const patterns: string[] = [];
  for (const row of rows) {
    const analysis = parseAnalysis(row.analysis);
    if (!analysis) continue;
    patterns.push(
      [
        `angle=${analysis.messagingAngle}`,
        analysis.problem ? `problem=${analysis.problem}` : null,
        analysis.promise ? `promise=${analysis.promise}` : null,
        analysis.audience ? `audience=${analysis.audience}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    );
  }
  return patterns;
}

async function loadOpportunityContext(
  siteId: string,
  opportunityId?: string
): Promise<{ title: string; angle: string | null; block: string } | null> {
  if (!opportunityId) return null;
  const row = await prisma.adOpportunity.findFirst({
    where: { id: opportunityId, siteId, dismissed: false },
  });
  if (!row) return null;
  const gap = (row.details ?? null) as CompetitorGapDetails | null;
  const angle = gap?.recommendedAngle ?? null;
  const lines = [
    `TITLE: ${row.title}`,
    `RATIONALE: ${row.rationale}`,
    angle ? `RECOMMENDED ANGLE: ${angle}` : "",
    gap?.focusedOn?.length ? `SET FOCUSES ON: ${gap.focusedOn.join(", ")}` : "",
    gap?.missing?.length ? `SET UNDERUSES: ${gap.missing.join(", ")}` : "",
    "This opportunity is an AI recommendation from stored analyses — not measured performance.",
  ].filter(Boolean);
  return { title: row.title, angle, block: lines.join("\n") };
}

async function buildGenerationContext(
  offeringId: string,
  brief: CampaignBrief
): Promise<{
  context: string;
  grounding: GenerationGrounding;
  offeringName: string;
  category: string | null;
  description: string;
}> {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { site: { include: { intelligence: true } } },
  });

  const details = (offering.details ?? {}) as unknown as OfferingDetails;
  const business = (offering.site.intelligence?.business ?? null) as BusinessProfile | null;
  const marketing = (offering.site.intelligence?.marketing ?? null) as MarketingAssets | null;

  const [patterns, opportunity] = await Promise.all([
    loadCompetitorPatterns(offering.siteId),
    loadOpportunityContext(offering.siteId, brief.opportunityId),
  ]);

  const imageAlts = await prisma.siteImage.findMany({
    where: { siteId: offering.siteId, offeringId: offering.id, alt: { not: null } },
    select: { alt: true },
    take: 8,
  });

  const context = [
    `BUSINESS: ${business?.companyName ?? offering.site.url}`,
    business?.description ? `ABOUT: ${business.description}` : "",
    business?.industry ? `INDUSTRY: ${business.industry}` : "",
    (business?.locations?.length ?? 0) > 0
      ? `BUSINESS LOCATIONS: ${business!.locations.join(", ")}`
      : "",
    "",
    `OFFERING (${offering.kind}): ${offering.name}`,
    details.category ? `CATEGORY: ${details.category}` : "",
    `DESCRIPTION: ${offering.description}`,
    offering.price ? `PRICE (verbatim from website): ${offering.price}` : "PRICE: not stated on website — do not mention price",
    (details.benefits?.length ?? 0) > 0 ? `BENEFITS: ${details.benefits!.join(" | ")}` : "",
    (details.features?.length ?? 0) > 0 ? `FEATURES: ${details.features!.join(" | ")}` : "",
    (details.targetAudience?.length ?? 0) > 0
      ? `AUDIENCE NAMED ON SITE: ${details.targetAudience!.join(" | ")}`
      : "",
    details.cta ? `WEBSITE CTA: ${details.cta}` : "",
    imageAlts.length > 0
      ? `PRODUCT IMAGE ALTS ON SITE: ${imageAlts.map((i) => i.alt).join(" | ")}`
      : "",
    "",
    (marketing?.valueProps?.length ?? 0) > 0
      ? `VALUE PROPS: ${marketing!.valueProps.slice(0, 8).join(" | ")}`
      : "",
    (marketing?.usps?.length ?? 0) > 0
      ? `USPS: ${marketing!.usps.slice(0, 6).join(" | ")}`
      : "",
    (marketing?.trustSignals?.length ?? 0) > 0
      ? `TRUST SIGNALS: ${marketing!.trustSignals.slice(0, 6).join(" | ")}`
      : "",
    (marketing?.promotions?.length ?? 0) > 0
      ? `ACTIVE PROMOTIONS (verbatim): ${marketing!.promotions.slice(0, 4).join(" | ")}`
      : "",
    (marketing?.testimonials?.length ?? 0) > 0
      ? `TESTIMONIALS (verbatim): ${marketing!.testimonials.slice(0, 3).join(" | ")}`
      : "",
    "",
    `CAMPAIGN NAME: ${brief.name}`,
    `GOAL: ${brief.goal.replaceAll("_", " ")}`,
    brief.objectiveNote ? `OBJECTIVE NOTE: ${brief.objectiveNote}` : "",
    `TONE: ${brief.tone}`,
    brief.angle ? `REQUESTED ANGLE: ${brief.angle}` : "",
    brief.offer
      ? `USER-SUPPLIED OFFER (only use if consistent with the site): ${brief.offer}`
      : "USER-SUPPLIED OFFER: none — do not invent an offer",
    `LANDING PAGE: ${brief.landingPage}`,
    brief.location ? `TARGET LOCATION: ${brief.location}` : "TARGET LOCATION: not specified",
    brief.audience ? `TARGET AUDIENCE: ${brief.audience}` : "",
    "",
    opportunity
      ? `ADVERTISING OPPORTUNITY:\n${opportunity.block}`
      : "ADVERTISING OPPORTUNITY: none selected",
    "",
    patterns.length > 0
      ? `COMPETITOR PATTERNS FROM ${patterns.length} ANALYZED LIBRARY ADS (do not copy):\n${patterns.map((p) => `- ${p}`).join("\n")}`
      : "COMPETITOR PATTERNS: none — no analyzed library ads. Write from the website only. Do not invent competitor ads or angles.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    context,
    grounding: {
      patternCount: patterns.length,
      opportunityTitle: opportunity?.title ?? null,
      opportunityAngle: opportunity?.angle ?? brief.angle ?? null,
      tone: brief.tone,
    },
    offeringName: offering.name,
    category: details.category ?? null,
    description: offering.description,
  };
}

/**
 * Generate original Google, Meta, and ChatGPT-style assets.
 * Grounded in site intelligence plus optional real library-ad patterns.
 * Stateless: nothing is persisted here.
 */
export async function generateAdAssets(
  offeringId: string,
  brief: CampaignBrief
): Promise<{ assets: GeneratedAdAssets; grounding: GenerationGrounding }> {
  const { context, grounding } = await buildGenerationContext(offeringId, brief);
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: context },
    ],
    text: { format: zodTextFormat(generationSchema, "ad_assets") },
  });

  const parsed = res.output_parsed;
  if (!parsed) throw new Error("AI ad generation returned no output.");
  return {
    assets: enforceLimits(parsed),
    grounding,
  };
}

const META_ONLY_PROMPT = `You write ORIGINAL Meta (Facebook/Instagram) ad copy for one product/service.

Grounding rules:
- Use only claims in the provided website data. Do not invent prices, discounts, guarantees, or statistics.
- Do not copy competitor headlines or primary text. Patterns are landscape signals only.
- If a requested angle is provided, write to that angle using site facts.
- primaryText: 1-3 short paragraphs, first line is the hook.
- headline: 40 characters or fewer. description: 30 characters or fewer.
- cta: best fit for the campaign goal. adSetName: short, audience-based.`;

const GOOGLE_ONLY_PROMPT = `You write ORIGINAL Google Ads assets for one product/service.

Grounding rules:
- Use only claims in the provided website data. Do not invent prices, discounts, guarantees, or statistics.
- Do not copy competitor headlines. Patterns are landscape signals only.
- If a requested angle is provided, write headlines and descriptions to that angle using site facts.
- 10-12 headlines ≤30 chars. 4 descriptions ≤90 chars.
- 12-20 keywords and 6-12 negativeKeywords, lowercase.
- path1/path2: short slugs ≤15 chars, or empty strings.
- pmaxConcepts: 2-3 planning concepts only — not live Performance Max campaigns.
- adGroupName: short, offering-based.`;

function limitGoogle(google: z.infer<typeof googleAssetsSchema>): GoogleAssets {
  return enforceLimits({
    google,
    meta: {
      adSetName: "",
      primaryText: "",
      headline: "",
      description: "",
      cta: "LEARN_MORE",
    },
    chatgpt: {
      advertiser: "",
      headline: "",
      description: "",
      prompt: "",
      answer: "",
      followUp: null,
      intents: [],
    },
    sellingPoints: [],
    audienceRecommendation: "",
  }).google;
}

/** Regenerate Google RSA + PMax concepts — used for Change Angle and New Version. */
export async function generateGoogleAssets(
  offeringId: string,
  brief: CampaignBrief
): Promise<{ google: GoogleAssets; grounding: GenerationGrounding }> {
  const { context, grounding } = await buildGenerationContext(offeringId, brief);
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: GOOGLE_ONLY_PROMPT },
      { role: "user", content: context },
    ],
    text: { format: zodTextFormat(googleAssetsSchema, "google_assets") },
  });
  const parsed = res.output_parsed;
  if (!parsed) throw new Error("Google ad generation returned no output.");
  return { google: limitGoogle(parsed), grounding };
}

const CHATGPT_ONLY_PROMPT = `You write ORIGINAL ChatGPT advertising assets for one product/service.

Write assets for the OpenAI Ads API. Headline and description become the published chat_card. Intents become context hints. Prompt and answer are preview context only.

Grounding rules:
- Use only claims in the provided website data. Do not invent prices, discounts, guarantees, or statistics.
- Do not copy competitor headlines. Patterns are landscape signals only.
- If a requested angle is provided, write the headline, description, and answer to that angle using site facts.
- advertiser: company name as the website uses it.
- headline ≤70 chars. description ≤180 chars.
- 6-10 short intents (buyer context), lowercase or title case, no punctuation spam.
- prompt: a realistic buyer question. answer: 2-4 grounded paragraphs. followUp: one next question or null.`;

function emptyGoogle(): GoogleAssets {
  return {
    adGroupName: "",
    headlines: [],
    descriptions: [],
    keywords: [],
    negativeKeywords: [],
    path1: "",
    path2: "",
    pmaxConcepts: [],
  };
}

function emptyMeta(): MetaAssets {
  return {
    adSetName: "",
    primaryText: "",
    headline: "",
    description: "",
    cta: "LEARN_MORE",
  };
}

function limitChatgpt(chatgpt: z.infer<typeof chatgptAssetsSchema>): ChatgptAssets {
  return enforceLimits({
    google: emptyGoogle(),
    meta: emptyMeta(),
    chatgpt,
    sellingPoints: [],
    audienceRecommendation: "",
  }).chatgpt;
}

/** Regenerate ChatGPT assets — used for Change Angle and New Version. */
export async function generateChatgptAssets(
  offeringId: string,
  brief: CampaignBrief
): Promise<{ chatgpt: ChatgptAssets; grounding: GenerationGrounding }> {
  const { context, grounding } = await buildGenerationContext(offeringId, brief);
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: CHATGPT_ONLY_PROMPT },
      { role: "user", content: context },
    ],
    text: { format: zodTextFormat(chatgptAssetsSchema, "chatgpt_assets") },
  });
  const parsed = res.output_parsed;
  if (!parsed) throw new Error("ChatGPT ad generation returned no output.");
  return { chatgpt: limitChatgpt(parsed), grounding };
}

/** Regenerate Meta copy only — used for Change Angle and New Version. */
export async function generateMetaAssets(
  offeringId: string,
  brief: CampaignBrief
): Promise<{ meta: MetaAssets; grounding: GenerationGrounding }> {
  const { context, grounding } = await buildGenerationContext(offeringId, brief);
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: META_ONLY_PROMPT },
      { role: "user", content: context },
    ],
    text: { format: zodTextFormat(metaAssetsSchema, "meta_assets") },
  });
  const parsed = res.output_parsed;
  if (!parsed) throw new Error("Meta ad generation returned no output.");
  return {
    meta: {
      ...parsed,
      headline: parsed.headline.slice(0, 40),
      description: parsed.description.slice(0, 30),
    },
    grounding,
  };
}
