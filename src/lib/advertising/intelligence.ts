import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { PageExtraction } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

const MAX_DIGEST_CHARS = 60_000;

// ---- Structured output schemas (OpenAI requires all fields; use nullable) ----

const businessSchema = z.object({
  companyName: z.string(),
  description: z.string(),
  industry: z.string(),
  locations: z.array(z.string()),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
});

const offeringSchema = z.object({
  kind: z.enum(["PRODUCT", "SERVICE"]),
  name: z.string(),
  description: z.string(),
  price: z.string().nullable(),
  url: z.string().nullable(),
  benefits: z.array(z.string()),
  features: z.array(z.string()),
  cta: z.string().nullable(),
  location: z.string().nullable(),
});

const marketingSchema = z.object({
  headlines: z.array(z.string()),
  valueProps: z.array(z.string()),
  ctas: z.array(z.string()),
  promotions: z.array(z.string()),
  testimonials: z.array(z.string()),
  trustSignals: z.array(z.string()),
  usps: z.array(z.string()),
});

const opportunitySchema = z.object({
  offeringName: z.string().nullable(),
  title: z.string(),
  level: z.enum(["HIGH", "MEDIUM", "LOW"]),
  rationale: z.string(),
  channels: z.array(z.enum(["google", "meta", "ai"])),
  recommendedCampaign: z.object({
    name: z.string(),
    goal: z.enum(["LEADS", "SALES", "TRAFFIC", "PHONE_CALLS", "AWARENESS"]),
    audience: z.string(),
    budgetHint: z.string(),
  }),
});

const intelligenceSchema = z.object({
  business: businessSchema,
  offerings: z.array(offeringSchema),
  marketing: marketingSchema,
  opportunities: z.array(opportunitySchema),
});

// ---- Digest ----

function buildAdvertisingDigest(siteUrl: string, pages: PageExtraction[]): string {
  const perPageBudget = Math.floor(MAX_DIGEST_CHARS / Math.max(pages.length, 1));
  const sections = pages.map((p) => {
    const faqs = p.faqs
      .slice(0, 6)
      .map((f) => `  Q: ${f.question}\n  A: ${f.answer.slice(0, 160)}`)
      .join("\n");
    const lines = [
      `PAGE: ${p.url}`,
      `TITLE: ${p.title ?? "(none)"}`,
      `META DESCRIPTION: ${p.metaDescription ?? "(none)"}`,
      `H1: ${p.headings.h1.join(" | ") || "(none)"}`,
      `H2: ${p.headings.h2.slice(0, 12).join(" | ") || "(none)"}`,
      `H3: ${p.headings.h3.slice(0, 12).join(" | ") || "(none)"}`,
      `CONTACT: phones=${p.contact.phones.join(",") || "none"} emails=${p.contact.emails.join(",") || "none"}`,
      faqs ? `FAQS:\n${faqs}` : "",
      `CONTENT: ${p.mainContent.slice(0, Math.max(perPageBudget - 1000, 500))}`,
    ].filter(Boolean);
    return lines.join("\n");
  });
  return `WEBSITE: ${siteUrl}\nPAGES CRAWLED: ${pages.length}\n\n${sections.join("\n\n---\n\n")}`;
}

// ---- Image harvesting (deterministic, no AI) ----

const JUNK_IMAGE_PATTERN =
  /logo|icon|favicon|sprite|avatar|placeholder|spacer|pixel|badge|arrow|\.svg(\?|$)/i;

interface HarvestedImage {
  url: string;
  alt: string | null;
  pageUrl: string;
}

function harvestImages(pages: PageExtraction[], cap = 80): HarvestedImage[] {
  const seen = new Set<string>();
  const out: HarvestedImage[] = [];
  for (const page of pages) {
    for (const img of page.images) {
      if (out.length >= cap) return out;
      if (!img.src || img.src.startsWith("data:")) continue;
      let absolute: string;
      try {
        absolute = new URL(img.src, page.url).toString();
      } catch {
        continue;
      }
      if (seen.has(absolute)) continue;
      if (JUNK_IMAGE_PATTERN.test(absolute)) continue;
      seen.add(absolute);
      out.push({ url: absolute, alt: img.alt?.trim() || null, pageUrl: page.url });
    }
  }
  return out;
}

// ---- Extraction ----

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to enable AI analysis."
    );
  }
  return new OpenAI();
}

const SYSTEM_PROMPT = `You are an advertising strategist analyzing a business website to prepare advertising campaigns. Extract ONLY information that is actually present on the website. Grounding rules (critical):
- Never invent prices, guarantees, certifications, medical claims, promotions, statistics or testimonials. If a price is not stated on the site, price must be null. Testimonials/promotions arrays must be empty unless real ones appear in the content.
- Quote prices, testimonials and promotions as close to verbatim as practical.
- offerings: identify each distinct advertisable product or service. Use the site's own naming. Set url to the most relevant page URL from the digest (or null). 3-15 offerings for a typical business; do not pad with duplicates or generic entries like "Contact Us".
- business: company name, a 1-3 sentence description of what the business does, industry, locations served, and contact details found on the site (null when absent).
- marketing: real headlines, value propositions, CTAs, promotions, testimonials, trust signals (e.g. licenses, review counts, years in business) and unique selling propositions found in the content.
- opportunities: 3-8 advertising opportunities ranked by potential. Each references an offering by exact name (offeringName) when applicable. level reflects commercial intent, urgency and margin potential (e.g. emergency services and high-ticket items are usually HIGH). channels: which of google / meta / ai suit it. recommendedCampaign is a realistic starting point; budgetHint is a short phrase like "$30-50/day", based on typical competitiveness, clearly a suggestion.`;

export interface IntelligenceExtraction {
  business: z.infer<typeof businessSchema>;
  offerings: z.infer<typeof offeringSchema>[];
  marketing: z.infer<typeof marketingSchema>;
  opportunities: z.infer<typeof opportunitySchema>[];
  images: HarvestedImage[];
}

export async function extractAdvertisingIntelligence(
  siteUrl: string,
  pages: PageExtraction[]
): Promise<IntelligenceExtraction> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const digest = buildAdvertisingDigest(siteUrl, pages);

  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: digest },
    ],
    text: { format: zodTextFormat(intelligenceSchema, "advertising_intelligence") },
  });

  const parsed = res.output_parsed;
  if (!parsed) throw new Error("AI intelligence extraction returned no output.");

  return { ...parsed, images: harvestImages(pages) };
}

// ---- Persistence ----

async function persistIntelligence(
  siteId: string,
  scanId: string,
  extraction: IntelligenceExtraction
): Promise<void> {
  const { business, offerings, marketing, opportunities, images } = extraction;

  // Offerings: upsert by (siteId, name); drop ones no longer found on the site.
  const names = offerings.map((o) => o.name);
  await prisma.offering.deleteMany({
    where: { siteId, name: { notIn: names } },
  });
  const offeringIdByName = new Map<string, string>();
  for (const o of offerings) {
    const row = await prisma.offering.upsert({
      where: { siteId_name: { siteId, name: o.name } },
      create: {
        siteId,
        kind: o.kind,
        name: o.name,
        description: o.description,
        price: o.price,
        url: o.url,
        details: asJson({
          benefits: o.benefits,
          features: o.features,
          cta: o.cta,
          location: o.location,
        }),
      },
      update: {
        kind: o.kind,
        description: o.description,
        price: o.price,
        url: o.url,
        details: asJson({
          benefits: o.benefits,
          features: o.features,
          cta: o.cta,
          location: o.location,
        }),
      },
    });
    offeringIdByName.set(o.name, row.id);
  }

  // Images: upsert by (siteId, url); associate with an offering when the image
  // was found on that offering's page.
  const offeringIdByPageUrl = new Map<string, string>();
  for (const o of offerings) {
    if (o.url && offeringIdByName.has(o.name)) {
      offeringIdByPageUrl.set(o.url, offeringIdByName.get(o.name)!);
    }
  }
  for (const img of images) {
    const offeringId = offeringIdByPageUrl.get(img.pageUrl) ?? null;
    await prisma.siteImage.upsert({
      where: { siteId_url: { siteId, url: img.url } },
      create: {
        siteId,
        url: img.url,
        alt: img.alt,
        pageUrl: img.pageUrl,
        offeringId,
      },
      update: { alt: img.alt, pageUrl: img.pageUrl, offeringId },
    });
  }

  // Opportunities: replace non-dismissed ones; keep dismissed so they stay hidden.
  const dismissed = await prisma.adOpportunity.findMany({
    where: { siteId, dismissed: true },
    select: { title: true },
  });
  const dismissedTitles = new Set(dismissed.map((d) => d.title));
  await prisma.adOpportunity.deleteMany({ where: { siteId, dismissed: false } });
  for (const opp of opportunities) {
    if (dismissedTitles.has(opp.title)) continue;
    await prisma.adOpportunity.create({
      data: {
        siteId,
        offeringId: opp.offeringName
          ? offeringIdByName.get(opp.offeringName) ?? null
          : null,
        title: opp.title,
        level: opp.level,
        rationale: opp.rationale,
        channels: asJson(opp.channels),
        recommendedCampaign: asJson(opp.recommendedCampaign),
      },
    });
  }

  await prisma.siteIntelligence.upsert({
    where: { siteId },
    create: {
      siteId,
      scanId,
      status: "COMPLETE",
      business: asJson(business),
      marketing: asJson(marketing),
    },
    update: {
      scanId,
      status: "COMPLETE",
      error: null,
      business: asJson(business),
      marketing: asJson(marketing),
    },
  });
}

/**
 * Run the advertising-intelligence extraction for a site using its most
 * recent completed scan (or a specific scan). Safe to re-run; results are
 * upserted.
 */
export async function runAdvertisingIntelligence(
  siteId: string,
  scanId?: string
): Promise<{ ok: boolean; error?: string }> {
  const scan = scanId
    ? await prisma.scan.findUnique({
        where: { id: scanId },
        include: { site: true, pages: true },
      })
    : await prisma.scan.findFirst({
        where: { siteId, status: "COMPLETE", benchmarkScanId: null },
        orderBy: { createdAt: "desc" },
        include: { site: true, pages: true },
      });

  if (!scan || scan.pages.length === 0) {
    return { ok: false, error: "No completed scan with pages found for this site." };
  }

  await prisma.siteIntelligence.upsert({
    where: { siteId },
    create: { siteId, scanId: scan.id, status: "RUNNING" },
    update: { scanId: scan.id, status: "RUNNING", error: null },
  });

  try {
    const pages = scan.pages.map((p) => p.extracted as unknown as PageExtraction);
    const extraction = await extractAdvertisingIntelligence(scan.site.url, pages);
    await persistIntelligence(siteId, scan.id, extraction);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[intelligence ${siteId}] failed:`, err);
    await prisma.siteIntelligence.updateMany({
      where: { siteId },
      data: { status: "FAILED", error: message },
    });
    return { ok: false, error: message };
  }
}
