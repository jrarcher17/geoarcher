import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { crawlOnePage } from "@/lib/crawler";
import { normalizeWebsite } from "@/lib/strategy";
import { assertCanAddSite } from "@/lib/user-plan";
import type { Prisma } from "@/generated/prisma/client";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

const JUNK_IMAGE =
  /logo|icon|favicon|sprite|avatar|placeholder|spacer|pixel|badge|arrow|\.svg(\?|$)/i;

const pageOfferingSchema = z.object({
  kind: z.enum(["PRODUCT", "SERVICE"]),
  name: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  price: z.string().nullable(),
  benefits: z.array(z.string()),
  features: z.array(z.string()),
  targetAudience: z.array(z.string()),
  cta: z.string().nullable(),
  location: z.string().nullable(),
  companyName: z.string().nullable(),
});

export interface IngestedProduct {
  id: string;
  siteId: string;
  name: string;
}

function originOf(pageUrl: string): string {
  return new URL(pageUrl).origin;
}

async function ensureUserSite(
  userId: string,
  siteUrl: string
): Promise<{ siteId: string; created: boolean }> {
  const site = await prisma.site.upsert({
    where: { url: siteUrl },
    update: {},
    create: { url: siteUrl },
  });
  const existing = await prisma.userSite.findUnique({
    where: { userId_siteId: { userId, siteId: site.id } },
  });
  if (!existing) {
    const limitError = await assertCanAddSite(userId);
    if (limitError) throw new Error(limitError);
    await prisma.userSite.create({
      data: { userId, siteId: site.id },
    });
    return { siteId: site.id, created: true };
  }
  return { siteId: site.id, created: false };
}

function harvestPageImages(
  pageUrl: string,
  images: { src: string; alt: string | null }[],
  cap = 24
): { url: string; alt: string | null; pageUrl: string }[] {
  const seen = new Set<string>();
  const out: { url: string; alt: string | null; pageUrl: string }[] = [];
  for (const img of images) {
    if (out.length >= cap || !img.src || img.src.startsWith("data:")) continue;
    let absolute: string;
    try {
      absolute = new URL(img.src, pageUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(absolute) || JUNK_IMAGE.test(absolute)) continue;
    seen.add(absolute);
    out.push({ url: absolute, alt: img.alt?.trim() || null, pageUrl });
  }
  return out;
}

async function persistOffering(input: {
  siteId: string;
  kind: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  price: string | null;
  url: string | null;
  details: Record<string, unknown>;
  images: { url: string; alt: string | null; pageUrl: string | null }[];
  companyName?: string | null;
}): Promise<IngestedProduct> {
  const name = input.name.trim().slice(0, 120);
  if (name.length < 2) throw new Error("Enter a product or service name.");
  const description = input.description.trim().slice(0, 2000);
  if (description.length < 8) {
    throw new Error("Add a short description of what you are advertising.");
  }

  const row = await prisma.offering.upsert({
    where: { siteId_name: { siteId: input.siteId, name } },
    create: {
      siteId: input.siteId,
      kind: input.kind,
      name,
      description,
      price: input.price,
      url: input.url,
      details: asJson(input.details),
    },
    update: {
      kind: input.kind,
      description,
      price: input.price,
      url: input.url,
      details: asJson(input.details),
    },
  });

  await Promise.all(
    input.images.map((img) =>
      prisma.siteImage.upsert({
        where: { siteId_url: { siteId: input.siteId, url: img.url } },
        create: {
          siteId: input.siteId,
          offeringId: row.id,
          url: img.url,
          alt: img.alt,
          pageUrl: img.pageUrl,
        },
        update: {
          offeringId: row.id,
          alt: img.alt ?? undefined,
          pageUrl: img.pageUrl ?? undefined,
        },
      })
    )
  );

  if (input.companyName?.trim()) {
    const intel = await prisma.siteIntelligence.findUnique({
      where: { siteId: input.siteId },
      select: { business: true },
    });
    const existing = (intel?.business ?? null) as { companyName?: string } | null;
    if (!existing?.companyName) {
      await prisma.siteIntelligence.upsert({
        where: { siteId: input.siteId },
        create: {
          siteId: input.siteId,
          status: "COMPLETE",
          business: asJson({
            companyName: input.companyName.trim(),
            brand: null,
            description: "",
            industry: "",
            locations: [],
            phone: null,
            email: null,
            address: null,
          }),
        },
        update: {
          business: asJson({
            ...(existing ?? {}),
            companyName: input.companyName.trim(),
          }),
        },
      });
    }
  }

  return { id: row.id, siteId: input.siteId, name: row.name };
}

function fallbackFromPage(
  page: {
    url: string;
    title: string | null;
    metaDescription: string | null;
    headings: { h1: string[] };
    mainContent: string;
  }
) {
  const name =
    page.headings.h1[0]?.trim() ||
    page.title?.replace(/\s+[|–-].+$/, "").trim() ||
    null;
  const description =
    page.metaDescription?.trim() ||
    page.mainContent.replace(/\s+/g, " ").trim().slice(0, 400) ||
    null;
  if (!name || !description) {
    throw new Error(
      "Could not tell what this page is selling. Add the product manually."
    );
  }
  return {
    kind: "PRODUCT" as const,
    name: name.slice(0, 120),
    description: description.slice(0, 2000),
    category: null,
    price: null,
    benefits: [] as string[],
    features: [] as string[],
    targetAudience: [] as string[],
    cta: null,
    location: null,
    companyName: null as string | null,
  };
}

async function extractOfferingFromPage(page: {
  url: string;
  title: string | null;
  metaDescription: string | null;
  headings: { h1: string[] };
  mainContent: string;
  jsonLdTypes?: string[];
}) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackFromPage(page);
  }
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const useLowReasoning = model.startsWith("gpt-5") || model.startsWith("o");
  const digest = [
    `PAGE URL: ${page.url}`,
    `TITLE: ${page.title ?? ""}`,
    `META: ${page.metaDescription ?? ""}`,
    `H1: ${page.headings.h1.join(" | ")}`,
    page.jsonLdTypes?.length
      ? `JSON-LD TYPES: ${page.jsonLdTypes.join(", ")}`
      : "",
    `CONTENT:\n${page.mainContent.slice(0, 8000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.responses.parse({
    model,
    ...(useLowReasoning ? { reasoning: { effort: "low" as const } } : {}),
    input: [
      {
        role: "system",
        content: `Extract the ONE product or service this page is selling. Use only facts on the page. Never invent price, benefits, audience, or company name. If a field is not stated, use null or []. If the page is not selling anything identifiable, still return the primary named offering from the title/H1 and a description from the page copy.`,
      },
      { role: "user", content: digest },
    ],
    text: { format: zodTextFormat(pageOfferingSchema, "page_offering") },
  });
  const parsed = res.output_parsed;
  if (!parsed?.name?.trim() || !parsed.description?.trim()) {
    return fallbackFromPage(page);
  }
  return parsed;
}

/** Scan a single product/service page. Does not crawl the rest of the site. */
export async function ingestProductPage(
  userId: string,
  rawUrl: string
): Promise<IngestedProduct> {
  const pageUrl = normalizeWebsite(rawUrl);
  if (!pageUrl) throw new Error("Enter a valid webpage URL.");

  const page = await crawlOnePage(pageUrl);
  const extracted = await extractOfferingFromPage(page);
  const { siteId } = await ensureUserSite(userId, originOf(page.url || pageUrl));
  const images = harvestPageImages(page.url, page.images);

  return persistOffering({
    siteId,
    kind: extracted.kind,
    name: extracted.name,
    description: extracted.description,
    price: extracted.price,
    url: page.url || pageUrl,
    details: {
      source: "PAGE_SCAN",
      benefits: extracted.benefits.slice(0, 8),
      features: extracted.features.slice(0, 8),
      cta: extracted.cta,
      location: extracted.location,
      category: extracted.category,
      targetAudience: extracted.targetAudience.slice(0, 6),
    },
    images,
    companyName: extracted.companyName,
  });
}

export async function ingestManualProduct(
  userId: string,
  input: {
    name: string;
    description: string;
    kind?: "PRODUCT" | "SERVICE";
    url?: string | null;
    price?: string | null;
    imageUrl?: string | null;
    companyName?: string | null;
  }
): Promise<IngestedProduct> {
  const landing = input.url ? normalizeWebsite(input.url) : null;
  if (!landing) {
    throw new Error("Enter the product or service landing page URL.");
  }
  const { siteId } = await ensureUserSite(userId, originOf(landing));
  const images = input.imageUrl?.trim()
    ? [{ url: input.imageUrl.trim(), alt: input.name.trim(), pageUrl: landing }]
    : [];

  return persistOffering({
    siteId,
    kind: input.kind === "SERVICE" ? "SERVICE" : "PRODUCT",
    name: input.name,
    description: input.description,
    price: input.price?.trim() || null,
    url: landing,
    details: {
      source: "MANUAL",
      benefits: [],
      features: [],
      cta: null,
      location: null,
      category: null,
      targetAudience: [],
    },
    images,
    companyName: input.companyName,
  });
}
