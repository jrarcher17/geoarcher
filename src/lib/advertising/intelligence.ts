import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { PageExtraction } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

const MAX_DIGEST_CHARS = 20_000;
const MAX_PRIORITY_PAGES = 18;
const MAX_OTHER_TITLES = 50;

// ---- Structured output schemas (OpenAI requires all fields; use nullable) ----

const businessSchema = z.object({
  companyName: z.string(),
  brand: z.string().nullable(),
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
  category: z.string().nullable(),
  price: z.string().nullable(),
  url: z.string().nullable(),
  benefits: z.array(z.string()),
  features: z.array(z.string()),
  targetAudience: z.array(z.string()),
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

const HIGH_VALUE_PATH =
  /\/(service|services|product|products|pricing|price|about|contact|location|locations|menu|treatment|treatments|package|packages|membership|shop|store|collection|collections|buy|book|booking|offer|offers|spa|wellness|team|faq|faqs|solutions|industries)(\/|$)/i;
const SKIP_PATH =
  /\/(blog|news|privacy|terms|cookie|cookies|legal|tag|category|author|cart|login|account|wp-content|feed|comment|comments|sitemap|search)(\/|$)/i;

function pathnameOf(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    return (path || "/").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function scoreAdvertisingPage(page: PageExtraction): number {
  const path = pathnameOf(page.url);
  let score = 0;
  if (path === "/") score += 120;
  if (HIGH_VALUE_PATH.test(path)) score += 55;
  if (SKIP_PATH.test(path)) score -= 50;
  const depth = path.split("/").filter(Boolean).length;
  score += Math.max(0, 12 - depth * 4);
  score += Math.min(25, Math.floor(page.wordCount / 80));
  if (page.contact.phones.length > 0 || page.contact.emails.length > 0) score += 12;
  const blob = `${page.title ?? ""} ${page.metaDescription ?? ""} ${page.headings.h1.join(" ")} ${page.mainContent.slice(0, 400)}`;
  if (/\$\d|price|starting at|book now|consultation|add to cart|buy now/i.test(blob))
    score += 18;
  if (
    (page.jsonLdTypes ?? []).some((t) =>
      /Product|Offer|Service|AggregateOffer/i.test(t)
    )
  ) {
    score += 35;
  }
  if (page.wordCount < 30 && path !== "/") score -= 15;
  return score;
}

/** Homepage, services, pricing and other ad-relevant pages — not the full crawl. */
export function selectAdvertisingPages(pages: PageExtraction[]): PageExtraction[] {
  return [...pages]
    .sort((a, b) => scoreAdvertisingPage(b) - scoreAdvertisingPage(a))
    .slice(0, MAX_PRIORITY_PAGES);
}

function summarizeProductSchema(jsonLd: unknown[]): string {
  const rows: string[] = [];
  const visit = (node: unknown) => {
    if (rows.length >= 8) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const rawType = obj["@type"];
    const types = Array.isArray(rawType)
      ? rawType.filter((t): t is string => typeof t === "string")
      : typeof rawType === "string"
        ? [rawType]
        : [];
    if (types.some((t) => /Product|Service|Offer|AggregateOffer/i.test(t))) {
      const name = typeof obj.name === "string" ? obj.name : "";
      const brand =
        typeof obj.brand === "string"
          ? obj.brand
          : obj.brand && typeof obj.brand === "object" && "name" in obj.brand
            ? String((obj.brand as { name?: unknown }).name ?? "")
            : "";
      const offers = obj.offers as Record<string, unknown> | undefined;
      const price =
        typeof offers?.price === "string" || typeof offers?.price === "number"
          ? String(offers.price)
          : typeof obj.price === "string" || typeof obj.price === "number"
            ? String(obj.price)
            : "";
      const desc =
        typeof obj.description === "string" ? obj.description.slice(0, 160) : "";
      rows.push(
        `  ${types.join("/")} name=${name || "?"} brand=${brand || "?"} price=${price || "?"} ${desc}`
      );
    }
    for (const value of Object.values(obj)) visit(value);
  };
  visit(jsonLd);
  return rows.join("\n");
}

function buildAdvertisingDigest(siteUrl: string, pages: PageExtraction[]): string {
  const selected = selectAdvertisingPages(pages);
  const selectedUrls = new Set(selected.map((p) => p.url));
  const perPageBudget = Math.floor(
    MAX_DIGEST_CHARS / Math.max(selected.length, 1)
  );
  const sections = selected.map((p) => {
    const faqs = p.faqs
      .slice(0, 4)
      .map((f) => `  Q: ${f.question}\n  A: ${f.answer.slice(0, 140)}`)
      .join("\n");
    const schema = summarizeProductSchema(p.jsonLd ?? []);
    const imageAlts = (p.images ?? [])
      .map((img) => img.alt?.trim())
      .filter((alt): alt is string => Boolean(alt))
      .slice(0, 6)
      .join(" | ");
    const lines = [
      `PAGE: ${p.url}`,
      `TITLE: ${p.title ?? "(none)"}`,
      `META DESCRIPTION: ${p.metaDescription ?? "(none)"}`,
      `H1: ${p.headings.h1.join(" | ") || "(none)"}`,
      `H2: ${p.headings.h2.slice(0, 10).join(" | ") || "(none)"}`,
      `STRUCTURED DATA: ${p.jsonLdTypes.join(", ") || "(none)"}`,
      schema ? `PRODUCT/OFFER SCHEMA:\n${schema}` : "",
      imageAlts ? `IMAGE ALTS: ${imageAlts}` : "",
      `CONTACT: phones=${p.contact.phones.join(",") || "none"} emails=${p.contact.emails.join(",") || "none"}`,
      faqs ? `FAQS:\n${faqs}` : "",
      `CONTENT: ${p.mainContent.slice(0, Math.max(perPageBudget - 900, 500))}`,
    ].filter(Boolean);
    return lines.join("\n");
  });
  const other = pages
    .filter((p) => !selectedUrls.has(p.url))
    .slice(0, MAX_OTHER_TITLES)
    .map((p) => `- ${p.url} | ${p.title ?? "(no title)"}`)
    .join("\n");
  const otherBlock = other
    ? `\n\nOTHER PAGES (titles only — ${pages.length - selected.length} not fully analyzed):\n${other}`
    : "";
  return `WEBSITE: ${siteUrl}\nPAGES CRAWLED: ${pages.length}\nPRIORITY PAGES ANALYZED: ${selected.length}\n\n${sections.join("\n\n---\n\n")}${otherBlock}`;
}

// ---- Image harvesting (deterministic, no AI) ----

const JUNK_IMAGE_PATTERN =
  /logo|icon|favicon|sprite|avatar|placeholder|spacer|pixel|badge|arrow|\.svg(\?|$)/i;

interface HarvestedImage {
  url: string;
  alt: string | null;
  pageUrl: string;
}

function harvestImages(pages: PageExtraction[], cap = 160): HarvestedImage[] {
  const seen = new Set<string>();
  const out: HarvestedImage[] = [];
  const ordered = [...pages].sort(
    (a, b) => scoreAdvertisingPage(b) - scoreAdvertisingPage(a)
  );
  for (const page of ordered) {
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

const SYSTEM_PROMPT = `You are an advertising strategist extracting Product Intelligence from a business website. Extract ONLY information that is actually present on the website. Grounding rules (critical):
- Never invent prices, guarantees, certifications, medical claims, promotions, statistics, audiences or testimonials. If a price is not stated on the site, price must be null. Testimonials/promotions arrays must be empty unless real ones appear in the content.
- Quote prices, testimonials and promotions as close to verbatim as practical.
- offerings: each distinct advertisable PRODUCT or SERVICE the company sells. Use the site's own naming. Set url to the most relevant page URL from the digest (or null). 3-10 offerings for a typical business.
- Do NOT treat these as offerings: blog posts, guides, category/hub pages, "Contact Us", "About", careers, login, or generic informational content. If a page is only a category listing, extract the sellable items on it — not the category itself.
- Do NOT extract pricing plans, billing tiers, or SKUs of the same product as separate offerings (e.g. Free / Pro / Unlimited). Extract the core product once; put plan names and prices in features or price when the site states them.
- kind: PRODUCT = a tangible or packaged item a customer can buy; SERVICE = work, subscription, or delivered expertise. When unsure, prefer SERVICE for agencies/SaaS platforms and PRODUCT for physical goods.
- category: the product/service category as the site names it (e.g. "Red Light Therapy"), or null.
- targetAudience: audiences the site itself names (athletes, agencies, homeowners). Empty if the site does not say.
- business.brand: the consumer-facing brand if it differs from the company name, else the company name, else null.
- business: company name, 1-3 sentence description, industry, locations served, contact (null when absent).
- marketing: real headlines, value propositions, CTAs, promotions, testimonials, trust signals and USPs. Keep each list to the strongest 6 items.
- opportunities: 3-6 advertising opportunities ranked by potential. Each references an offering by exact name (offeringName) when applicable. level reflects commercial intent, urgency and margin potential. channels: google / meta / ai. recommendedCampaign is a realistic starting point; budgetHint is a suggestion like "$30-50/day".`;

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
  const useLowReasoning = model.startsWith("gpt-5") || model.startsWith("o");

  const res = await client.responses.parse({
    model,
    ...(useLowReasoning ? { reasoning: { effort: "low" } } : {}),
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: digest },
    ],
    text: { format: zodTextFormat(intelligenceSchema, "advertising_intelligence") },
  });

  const parsed = res.output_parsed;
  if (!parsed) throw new Error("AI intelligence extraction returned no output.");

  return {
    business: {
      ...parsed.business,
      brand: parsed.business.brand || parsed.business.companyName || null,
    },
    offerings: parsed.offerings.slice(0, 10).map((o) => ({
      ...o,
      category: o.category || null,
      targetAudience: o.targetAudience.slice(0, 6),
      benefits: o.benefits.slice(0, 8),
      features: o.features.slice(0, 8),
    })),
    marketing: {
      headlines: parsed.marketing.headlines.slice(0, 6),
      valueProps: parsed.marketing.valueProps.slice(0, 6),
      ctas: parsed.marketing.ctas.slice(0, 6),
      promotions: parsed.marketing.promotions.slice(0, 6),
      testimonials: parsed.marketing.testimonials.slice(0, 6),
      trustSignals: parsed.marketing.trustSignals.slice(0, 6),
      usps: parsed.marketing.usps.slice(0, 6),
    },
    opportunities: parsed.opportunities.slice(0, 6),
    images: harvestImages(pages),
  };
}

function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function matchOfferingByImage(
  img: HarvestedImage,
  offerings: z.infer<typeof offeringSchema>[],
  offeringIdByName: Map<string, string>
): string | null {
  const hay = `${img.alt ?? ""} ${img.url} ${img.pageUrl}`.toLowerCase();
  let best: { name: string; score: number } | null = null;
  for (const o of offerings) {
    let score = 0;
    if (o.url && normalizePageUrl(img.pageUrl) === normalizePageUrl(o.url)) {
      score += 10;
    }
    const tokens = o.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);
    for (const token of tokens) {
      if (hay.includes(token)) score += token.length > 5 ? 3 : 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { name: o.name, score };
    }
  }
  if (!best || best.score < 2) return null;
  return offeringIdByName.get(best.name) ?? null;
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
          category: o.category,
          targetAudience: o.targetAudience,
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
          category: o.category,
          targetAudience: o.targetAudience,
        }),
      },
    });
    offeringIdByName.set(o.name, row.id);
  }

  // Images: upsert by (siteId, url); associate with an offering when the image
  // was found on that offering's page or the alt/filename matches the name.
  const offeringIdByPageUrl = new Map<string, string>();
  for (const o of offerings) {
    const id = offeringIdByName.get(o.name);
    if (!id || !o.url) continue;
    offeringIdByPageUrl.set(normalizePageUrl(o.url), id);
  }
  await Promise.all(
    images.map((img) => {
      const offeringId =
        offeringIdByPageUrl.get(normalizePageUrl(img.pageUrl)) ??
        matchOfferingByImage(img, offerings, offeringIdByName);
      return prisma.siteImage.upsert({
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
    })
  );

  // Site opportunities only — competitor-gap rows are owned by the gap engine.
  const dismissed = await prisma.adOpportunity.findMany({
    where: { siteId, dismissed: true, source: "SITE" },
    select: { title: true },
  });
  const dismissedTitles = new Set(dismissed.map((d) => d.title));
  await prisma.adOpportunity.deleteMany({
    where: { siteId, dismissed: false, source: "SITE" },
  });
  for (const opp of opportunities) {
    if (dismissedTitles.has(opp.title)) continue;
    await prisma.adOpportunity.create({
      data: {
        siteId,
        source: "SITE",
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
    try {
      const { discoverCompetitors } = await import("./competitors");
      await discoverCompetitors(siteId);
    } catch (err) {
      console.error(`[competitors ${siteId}] discovery failed:`, err);
    }
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
