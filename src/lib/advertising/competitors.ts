import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { BusinessProfile, MarketingAssets, OfferingDetails } from "./types";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

const competitorSchema = z.object({
  name: z.string(),
  offeringName: z.string().nullable(),
  category: z.string().nullable(),
  rationale: z.string(),
  similarProducts: z.array(z.string()),
  searchTerms: z.array(z.string()),
  customerProblems: z.array(z.string()),
  customerIntent: z.array(z.string()),
  mentionedOnSite: z.boolean(),
});

const discoverySchema = z.object({
  competitors: z.array(competitorSchema),
});

const SYSTEM_PROMPT = `You recommend advertising competitors for a business from its extracted website intelligence.

Grounding rules (critical):
- Only name real, well-known brands that sell similar products or services in the same category.
- If you are not confident a brand exists and competes here, omit it. Prefer fewer accurate names over a long list.
- Never invent websites, ad counts, spend, dates, publication, or that a brand currently advertises.
- Do not include the company's own brand or parent company as a competitor.
- mentionedOnSite: true only when the brand name appears in the provided site facts (description, offerings, headlines, value props). Otherwise false.
- similarProducts, searchTerms, customerProblems, customerIntent are AI recommendations inferred from the user's products — not measured advertising data.
- 4–8 competitors. Prefer brands a media buyer would actually bid against.
- Use the site's own naming when tying a competitor to an offering (offeringName must match an offering exactly, or be null).`;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to enable competitor discovery."
    );
  }
  return new OpenAI();
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export interface CompetitorDetails {
  similarProducts: string[];
  searchTerms: string[];
  customerProblems: string[];
  customerIntent: string[];
}

/** Suggest competitors from stored site intelligence. Does not invent ads. */
export async function discoverCompetitors(
  siteId: string
): Promise<{ created: number; error?: string }> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      intelligence: true,
      offerings: { orderBy: { name: "asc" } },
    },
  });
  if (!site) return { created: 0, error: "Site not found." };
  if (site.intelligence?.status !== "COMPLETE" || !site.intelligence.business) {
    return {
      created: 0,
      error: "Finish a website scan first. Competitors are suggested from product intelligence.",
    };
  }

  const business = site.intelligence.business as unknown as BusinessProfile;
  const marketing =
    (site.intelligence.marketing as unknown as MarketingAssets | null) ?? null;
  const ownNames = new Set(
    [business.companyName, business.brand]
      .filter((n): n is string => Boolean(n))
      .map((n) => n.toLowerCase())
  );

  const offeringLines = site.offerings.map((o) => {
    const details = (o.details ?? {}) as unknown as OfferingDetails;
    return [
      `- ${o.name} (${o.kind})`,
      details.category ? `  category: ${details.category}` : "",
      `  ${o.description}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const facts = [
    `WEBSITE: ${site.url}`,
    `COMPANY: ${business.companyName}`,
    business.brand ? `BRAND: ${business.brand}` : "",
    `INDUSTRY: ${business.industry}`,
    `DESCRIPTION: ${business.description}`,
    "",
    "OFFERINGS:",
    offeringLines.join("\n") || "(none extracted)",
    "",
    marketing?.headlines?.length
      ? `HEADLINES: ${marketing.headlines.join(" | ")}`
      : "",
    marketing?.valueProps?.length
      ? `VALUE PROPS: ${marketing.valueProps.join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const useLowReasoning = model.startsWith("gpt-5") || model.startsWith("o");

  const res = await client.responses.parse({
    model,
    ...(useLowReasoning ? { reasoning: { effort: "low" } } : {}),
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: facts },
    ],
    text: { format: zodTextFormat(discoverySchema, "competitor_discovery") },
  });

  const parsed = res.output_parsed;
  if (!parsed) throw new Error("Competitor discovery returned no output.");

  const offeringIdByName = new Map(
    site.offerings.map((o) => [o.name.toLowerCase(), o.id])
  );

  const keep = await prisma.adCompetitor.findMany({
    where: {
      siteId,
      OR: [{ source: "MANUAL" }, { dismissed: true }],
    },
    select: { name: true },
  });
  const keepNames = new Set(keep.map((k) => normalizeName(k.name).toLowerCase()));

  await prisma.adCompetitor.deleteMany({
    where: {
      siteId,
      source: { in: ["AI_RECOMMENDATION", "MENTIONED"] },
      dismissed: false,
    },
  });

  let created = 0;
  const seen = new Set<string>();
  for (const raw of parsed.competitors.slice(0, 8)) {
    const name = normalizeName(raw.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key) || keepNames.has(key) || ownNames.has(key)) continue;
    seen.add(key);

    await prisma.adCompetitor.create({
      data: {
        siteId,
        offeringId: raw.offeringName
          ? offeringIdByName.get(raw.offeringName.toLowerCase()) ?? null
          : null,
        name,
        website: null,
        category: raw.category || null,
        rationale: raw.rationale,
        details: asJson({
          similarProducts: raw.similarProducts.slice(0, 6),
          searchTerms: raw.searchTerms.slice(0, 8),
          customerProblems: raw.customerProblems.slice(0, 6),
          customerIntent: raw.customerIntent.slice(0, 6),
        } satisfies CompetitorDetails),
        source: raw.mentionedOnSite ? "MENTIONED" : "AI_RECOMMENDATION",
      },
    });
    created += 1;
  }

  return { created };
}

export async function addManualCompetitor(input: {
  siteId: string;
  name: string;
  website?: string | null;
  offeringId?: string | null;
}): Promise<{ id: string } | { error: string; status: number }> {
  const name = normalizeName(input.name);
  if (!name) return { error: "Enter a competitor brand name.", status: 400 };

  let website: string | null = null;
  if (input.website?.trim()) {
    try {
      const parsed = new URL(input.website.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { error: "Website must be an http(s) URL.", status: 400 };
      }
      website = parsed.toString();
    } catch {
      return { error: "Website must be a valid URL.", status: 400 };
    }
  }

  if (input.offeringId) {
    const offering = await prisma.offering.findFirst({
      where: { id: input.offeringId, siteId: input.siteId },
      select: { id: true },
    });
    if (!offering) return { error: "Product not found on this site.", status: 400 };
  }

  const existing = await prisma.adCompetitor.findUnique({
    where: { siteId_name: { siteId: input.siteId, name } },
  });
  if (existing) {
    if (existing.dismissed) {
      const row = await prisma.adCompetitor.update({
        where: { id: existing.id },
        data: {
          dismissed: false,
          source: "MANUAL",
          website,
          offeringId: input.offeringId ?? existing.offeringId,
          rationale: existing.rationale || "Added by you.",
        },
      });
      return { id: row.id };
    }
    return { error: "That competitor is already on this site.", status: 409 };
  }

  const row = await prisma.adCompetitor.create({
    data: {
      siteId: input.siteId,
      offeringId: input.offeringId ?? null,
      name,
      website,
      rationale: "Added by you.",
      source: "MANUAL",
    },
  });
  return { id: row.id };
}
