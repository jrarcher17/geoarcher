import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type {
  BusinessProfile,
  MarketingAssets,
  OfferingDetails,
} from "@/lib/advertising/types";

// ---- Output schema (structured outputs; platform limits enforced after) ----

const googleAssetsSchema = z.object({
  adGroupName: z.string(),
  /// Up to 30 characters each
  headlines: z.array(z.string()),
  /// Up to 90 characters each
  descriptions: z.array(z.string()),
  keywords: z.array(z.string()),
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

const generationSchema = z.object({
  google: googleAssetsSchema,
  meta: metaAssetsSchema,
  sellingPoints: z.array(z.string()),
  audienceRecommendation: z.string(),
});

export type GoogleAssets = z.infer<typeof googleAssetsSchema>;
export type MetaAssets = z.infer<typeof metaAssetsSchema>;
export type GeneratedAdAssets = z.infer<typeof generationSchema>;

export interface CampaignBrief {
  name: string;
  goal: "LEADS" | "SALES" | "TRAFFIC" | "PHONE_CALLS" | "AWARENESS";
  landingPage: string;
  budgetDailyCents: number | null;
  location: string;
  audience: string;
}

const SYSTEM_PROMPT = `You are a senior performance-marketing copywriter. Generate advertising assets for one product/service using ONLY the provided website intelligence.

Grounding rules (critical — violating them is a failure):
- Use only claims, prices, features, benefits, testimonials and promotions present in the provided data. Do not invent guarantees, certifications, statistics, awards, discounts or medical claims.
- Mention price only if a price is provided.
- Write in the business's voice; specific and concrete, never generic filler like "best in town".

Google Ads (responsive search ad):
- 10-12 headlines, each 30 characters or fewer. Mix: offering name, benefit-led, location-led (if a target location is given), CTA-led.
- 4 descriptions, each 90 characters or fewer.
- 12-20 keywords a buyer would search, matching the offering and location. Lowercase, no punctuation.
- adGroupName: short, offering-based.

Meta (Facebook/Instagram feed ad):
- primaryText: 1-3 short paragraphs, first line hooks the target audience's problem or desire. May include 1-2 tasteful emoji only if fitting for the brand.
- headline: 40 characters or fewer. description: 30 characters or fewer.
- cta: pick the best fit for the campaign goal.
- adSetName: short, audience-based.

Also return 3-6 sellingPoints (grounded) and a one-sentence audienceRecommendation refining the given audience for this specific ad.`;

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
    },
    meta: {
      ...assets.meta,
      headline: assets.meta.headline.slice(0, 40),
      description: assets.meta.description.slice(0, 30),
    },
  };
}

/**
 * Generate Google + Meta ad assets for an offering, grounded exclusively in
 * the site's extracted intelligence. Stateless: nothing is persisted here.
 */
export async function generateAdAssets(
  offeringId: string,
  brief: CampaignBrief
): Promise<GeneratedAdAssets> {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { site: { include: { intelligence: true } } },
  });

  const details = (offering.details ?? {}) as unknown as OfferingDetails;
  const business = (offering.site.intelligence?.business ?? null) as BusinessProfile | null;
  const marketing = (offering.site.intelligence?.marketing ?? null) as MarketingAssets | null;

  const context = [
    `BUSINESS: ${business?.companyName ?? offering.site.url}`,
    business?.description ? `ABOUT: ${business.description}` : "",
    business?.industry ? `INDUSTRY: ${business.industry}` : "",
    (business?.locations?.length ?? 0) > 0
      ? `BUSINESS LOCATIONS: ${business!.locations.join(", ")}`
      : "",
    "",
    `OFFERING (${offering.kind}): ${offering.name}`,
    `DESCRIPTION: ${offering.description}`,
    offering.price ? `PRICE (verbatim from website): ${offering.price}` : "PRICE: not stated on website — do not mention price",
    (details.benefits?.length ?? 0) > 0 ? `BENEFITS: ${details.benefits!.join(" | ")}` : "",
    (details.features?.length ?? 0) > 0 ? `FEATURES: ${details.features!.join(" | ")}` : "",
    details.cta ? `WEBSITE CTA: ${details.cta}` : "",
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
    `LANDING PAGE: ${brief.landingPage}`,
    brief.location ? `TARGET LOCATION: ${brief.location}` : "TARGET LOCATION: not specified",
    brief.audience ? `TARGET AUDIENCE: ${brief.audience}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

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
  return enforceLimits(parsed);
}
