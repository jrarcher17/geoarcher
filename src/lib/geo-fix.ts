import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  ContentGap,
  FaqItem,
  PageExtraction,
  SemanticMap,
  Understanding,
} from "./types";

export interface GeoJsonLdBlock {
  id: string;
  label: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface GeoMetaTags {
  "geoarcher:topic"?: string;
  "geoarcher:summary"?: string;
}

export interface GeoFixProposal {
  blocks: GeoJsonLdBlock[];
  meta: GeoMetaTags;
}

function siteNameFromUrl(siteUrl: string): string {
  try {
    const host = new URL(siteUrl).hostname.replace(/^www\./, "");
    const part = host.split(".")[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
  } catch {
    return "Business";
  }
}

function homepage(pages: PageExtraction[]): PageExtraction | undefined {
  return (
    pages.find((p) => {
      try {
        const u = new URL(p.url);
        return u.pathname === "/" || u.pathname === "";
      } catch {
        return false;
      }
    }) ?? pages[0]
  );
}

function collectFaqs(pages: PageExtraction[]): FaqItem[] {
  const seen = new Set<string>();
  const out: FaqItem[] = [];
  for (const p of pages) {
    for (const f of p.faqs) {
      const key = f.question.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out.slice(0, 30);
}

export function buildGeoFixProposal(input: {
  siteUrl: string;
  pages: PageExtraction[];
  understanding: Understanding;
  semanticMap: SemanticMap;
  contentGaps: ContentGap[];
  gapFaqs?: FaqItem[];
}): GeoFixProposal {
  const { siteUrl, pages, understanding, semanticMap, contentGaps } = input;
  const home = homepage(pages);
  const name =
    home?.title?.split("|")[0]?.split("–")[0]?.trim() ||
    siteNameFromUrl(siteUrl);
  const description =
    home?.metaDescription?.trim() ||
    understanding.businessSummary.slice(0, 300);
  const faqs = [...collectFaqs(pages), ...(input.gapFaqs ?? [])].slice(0, 40);

  const blocks: GeoJsonLdBlock[] = [];

  const org: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: siteUrl,
    description,
  };
  const phone = home?.contact.phones[0];
  const email = home?.contact.emails[0];
  if (phone) org.telephone = phone;
  if (email) org.email = email;
  blocks.push({
    id: "organization",
    label: "Organization",
    description: "Who you are — name, URL, contact signals for AI and search.",
    schema: org,
  });

  blocks.push({
    id: "website",
    label: "WebSite",
    description: "Site-level entity linked to your organization.",
    schema: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name,
      url: siteUrl,
      description,
      publisher: { "@type": "Organization", name, url: siteUrl },
    },
  });

  if (phone || email || understanding.serviceArea) {
    const local: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name,
      url: siteUrl,
      description,
    };
    if (phone) local.telephone = phone;
    if (email) local.email = email;
    if (
      understanding.serviceArea &&
      understanding.serviceArea.toLowerCase() !== "global" &&
      understanding.serviceArea.toLowerCase() !== "unknown"
    ) {
      local.areaServed = understanding.serviceArea;
    }
    blocks.push({
      id: "local-business",
      label: "LocalBusiness",
      description: "Service area and contact — helps local recommendation prompts.",
      schema: local,
    });
  }

  if (semanticMap.subtopics.length > 0) {
    blocks.push({
      id: "services",
      label: "Service catalog (ItemList)",
      description: "Topics/subtopics AI associates with your business.",
      schema: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${name} — ${semanticMap.topic}`,
        itemListElement: semanticMap.subtopics.slice(0, 12).map((topic, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: topic,
        })),
      },
    });
  }

  if (faqs.length > 0) {
    blocks.push({
      id: "faq",
      label: "FAQPage",
      description: `${faqs.length} Q&A pairs from your crawl${input.gapFaqs?.length ? " plus AI-drafted answers for content gaps" : ""}.`,
      schema: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.answer,
          },
        })),
      },
    });
  } else if (contentGaps.length > 0) {
    blocks.push({
      id: "faq-gaps-placeholder",
      label: "FAQPage (draft from gaps)",
      description:
        "Run “Draft gap FAQs” to generate answers for missing questions, then approve.",
      schema: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: contentGaps.slice(0, 8).map((g) => ({
          "@type": "Question",
          name: g.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: "See our website or contact us for details.",
          },
        })),
      },
    });
  }

  const meta: GeoMetaTags = {
    "geoarcher:topic": semanticMap.topic,
    "geoarcher:summary": understanding.businessSummary.slice(0, 500),
  };

  return { blocks, meta };
}

const gapFaqSchema = z.object({
  faqs: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ),
});

/** Draft FAQ answers for content gaps (requires OpenAI). */
export async function draftGapFaqs(
  siteUrl: string,
  understanding: Understanding,
  gaps: ContentGap[]
): Promise<FaqItem[]> {
  if (!process.env.OPENAI_API_KEY || gaps.length === 0) return [];
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const res = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content:
          "Draft concise FAQ answers for a business website. Answers must be factual-sounding but generic where the site lacks specifics — never invent prices, guarantees, or legal outcomes. Each answer 1-3 sentences, suitable for JSON-LD FAQPage markup. Match the business described.",
      },
      {
        role: "user",
        content: `Site: ${siteUrl}\nBusiness: ${understanding.businessSummary}\nAudience: ${understanding.audience}\nService area: ${understanding.serviceArea}\n\nQuestions:\n${gaps.map((g, i) => `${i + 1}. ${g.question}`).join("\n")}`,
      },
    ],
    text: { format: zodTextFormat(gapFaqSchema, "gap_faqs") },
  });
  return res.output_parsed?.faqs ?? [];
}

export function blocksToJsonLd(blocks: GeoJsonLdBlock[]): Record<string, unknown>[] {
  return blocks.map((b) => b.schema);
}
