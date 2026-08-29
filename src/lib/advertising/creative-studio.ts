import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { BusinessProfile, OfferingDetails } from "@/lib/advertising/types";
import {
  CONCEPT_ANGLES,
  type ConceptAngle,
  type CreativeFormat,
  type CreativePlatform,
} from "@/lib/advertising/creative-formats";

const layoutCopySchema = z.object({
  hook: z.string(),
  headline: z.string(),
  description: z.string(),
  cta: z.string(),
  creativeConcept: z.string(),
  platforms: z.array(z.enum(["META", "GOOGLE", "AI_CHAT"])),
});

const conceptsSchema = z.object({
  concepts: z.array(
    layoutCopySchema.extend({
      angle: z.string(),
    })
  ),
});

export type LayoutCopy = z.infer<typeof layoutCopySchema>;
export type ConceptCard = LayoutCopy & { angle: string };

export interface CreativeGrounding {
  offeringName: string;
  angle: string | null;
  format: CreativeFormat | null;
  platform: CreativePlatform | null;
}

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to generate creatives."
    );
  }
  return new OpenAI();
}

async function offeringContext(offeringId: string): Promise<{
  context: string;
  offeringName: string;
}> {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { site: { include: { intelligence: true } } },
  });
  const details = (offering.details ?? {}) as unknown as OfferingDetails;
  const business = (offering.site.intelligence?.business ?? null) as BusinessProfile | null;
  const context = [
    `BUSINESS: ${business?.companyName ?? offering.site.url}`,
    business?.description ? `ABOUT: ${business.description}` : "",
    `OFFERING (${offering.kind}): ${offering.name}`,
    details.category ? `CATEGORY: ${details.category}` : "",
    `DESCRIPTION: ${offering.description}`,
    offering.price
      ? `PRICE (verbatim from website): ${offering.price}`
      : "PRICE: not stated — do not mention price",
    (details.benefits?.length ?? 0) > 0
      ? `BENEFITS: ${details.benefits!.join(" | ")}`
      : "",
    (details.features?.length ?? 0) > 0
      ? `FEATURES: ${details.features!.join(" | ")}`
      : "",
    (details.targetAudience?.length ?? 0) > 0
      ? `AUDIENCE NAMED ON SITE: ${details.targetAudience!.join(" | ")}`
      : "",
    details.cta ? `WEBSITE CTA: ${details.cta}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { context, offeringName: offering.name };
}

function limitCopy(copy: LayoutCopy): LayoutCopy {
  return {
    hook: copy.hook.trim().slice(0, 120),
    headline: copy.headline.trim().slice(0, 48),
    description: copy.description.trim().slice(0, 160),
    cta: copy.cta.trim().slice(0, 24),
    creativeConcept: copy.creativeConcept.trim().slice(0, 280),
    platforms: copy.platforms.slice(0, 3),
  };
}

const COPY_RULES = `You write ORIGINAL advertising creative direction for one product/service.

Grounding rules:
- Use only claims in the website data. Do not invent prices, discounts, guarantees, or statistics.
- Do not invent competitor ads or a competitive landscape.
- headline ≤48 characters. description ≤160 characters. cta is 1-3 words.
- hook: one opening line for the layout.
- creativeConcept: how to compose the visual (background, crop, mood). Do not describe a fake photograph of a real product that is not on the site.
- platforms: which of META, GOOGLE, AI_CHAT this concept fits. Prefer the requested platform first.`;

/** One layout's copy for Creative Studio. */
export async function generateLayoutCopy(input: {
  offeringId: string;
  platform: CreativePlatform;
  angle: string;
  format: CreativeFormat;
}): Promise<{ copy: LayoutCopy; grounding: CreativeGrounding }> {
  const { context, offeringName } = await offeringContext(input.offeringId);
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: COPY_RULES },
      {
        role: "user",
        content: [
          context,
          "",
          `REQUESTED PLATFORM: ${input.platform}`,
          `REQUESTED ANGLE: ${input.angle}`,
          `FORMAT: ${input.format}`,
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(layoutCopySchema, "layout_copy") },
  });
  const parsed = res.output_parsed;
  if (!parsed) throw new Error("Creative generation returned no copy.");
  return {
    copy: limitCopy(parsed),
    grounding: {
      offeringName,
      angle: input.angle,
      format: input.format,
      platform: input.platform,
    },
  };
}

/** Ten original concept cards — copy only, no invented ads or images. */
export async function generateConceptCards(input: {
  offeringId: string;
  platform: CreativePlatform;
}): Promise<{ concepts: ConceptCard[]; grounding: CreativeGrounding }> {
  const { context, offeringName } = await offeringContext(input.offeringId);
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const angles = CONCEPT_ANGLES.join(", ");
  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: COPY_RULES },
      {
        role: "user",
        content: [
          context,
          "",
          `REQUESTED PLATFORM: ${input.platform}`,
          `Return exactly 10 concepts, one for each angle: ${angles}.`,
          "Each concept.angle must be one of those ten, used once.",
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(conceptsSchema, "concept_cards") },
  });
  const parsed = res.output_parsed;
  if (!parsed) throw new Error("Concept generation returned no output.");
  const used = new Set<string>();
  const concepts: ConceptCard[] = [];
  for (const row of parsed.concepts) {
    const angle = CONCEPT_ANGLES.includes(row.angle as ConceptAngle)
      ? row.angle
      : CONCEPT_ANGLES[concepts.length] ?? row.angle;
    if (used.has(angle)) continue;
    used.add(angle);
    concepts.push({ ...limitCopy(row), angle });
    if (concepts.length === 10) break;
  }
  return {
    concepts,
    grounding: {
      offeringName,
      angle: null,
      format: null,
      platform: input.platform,
    },
  };
}
