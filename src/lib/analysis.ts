import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  GEO_COMPONENT_NAMES,
  type ContentGap,
  type GeoScore,
  type PageExtraction,
  type Recommendation,
  type SemanticMap,
  type Understanding,
} from "./types";

const MAX_DIGEST_CHARS = 60_000;

export function buildSiteDigest(siteUrl: string, pages: PageExtraction[]): string {
  const perPageBudget = Math.floor(MAX_DIGEST_CHARS / Math.max(pages.length, 1));
  const sections = pages.map((p) => {
    const faqs = p.faqs
      .slice(0, 8)
      .map((f) => `  Q: ${f.question}\n  A: ${f.answer.slice(0, 200)}`)
      .join("\n");
    const lines = [
      `PAGE: ${p.url}`,
      `TITLE: ${p.title ?? "(none)"}`,
      `META DESCRIPTION: ${p.metaDescription ?? "(none)"}`,
      `H1: ${p.headings.h1.join(" | ") || "(none)"}`,
      `H2: ${p.headings.h2.slice(0, 12).join(" | ") || "(none)"}`,
      `STRUCTURED DATA TYPES: ${p.jsonLdTypes.join(", ") || "(none)"}`,
      `AUTHOR: ${p.author ?? "(none)"}  PUBLISHED: ${p.publishedAt ?? "(unknown)"}`,
      `CONTACT: phones=${p.contact.phones.join(",") || "none"} emails=${p.contact.emails.join(",") || "none"}`,
      `REVIEW MARKUP: ${p.hasReviewMarkup}  TABLES: ${p.tableCount}  IMAGES MISSING ALT: ${p.imagesMissingAlt}/${p.images.length}`,
      faqs ? `FAQS:\n${faqs}` : `FAQS: (none)`,
      `CONTENT: ${p.mainContent.slice(0, Math.max(perPageBudget - 1200, 500))}`,
    ];
    return lines.join("\n");
  });
  return `WEBSITE: ${siteUrl}\nPAGES CRAWLED: ${pages.length}\n\n${sections.join("\n\n---\n\n")}`;
}

// ---- Zod schemas for structured outputs ----

const understandingSchema = z.object({
  businessSummary: z.string(),
  confidence: z.number(),
  audience: z.string(),
  serviceArea: z.string(),
  differentiators: z.array(z.string()),
  problems: z.array(z.object({ issue: z.string(), detail: z.string() })),
  semanticMap: z.object({
    topic: z.string(),
    subtopics: z.array(z.string()),
  }),
});

const geoSchema = z.object({
  components: z.array(
    z.object({
      name: z.enum(GEO_COMPONENT_NAMES),
      score: z.number(),
      findings: z.string(),
      quickWin: z.string(),
    })
  ),
});

const gapsRecsSchema = z.object({
  contentGaps: z.array(
    z.object({ question: z.string(), whyItMatters: z.string() })
  ),
  recommendations: z.array(
    z.object({
      title: z.string(),
      why: z.string(),
      how: z.string(),
      impact: z.enum(["high", "medium", "low"]),
      effort: z.enum(["low", "medium", "high"]),
      category: z.string(),
    })
  ),
});

export interface FullAnalysis {
  understanding: Understanding;
  semanticMap: SemanticMap;
  geoScore: GeoScore;
  contentGaps: ContentGap[];
  recommendations: Recommendation[];
}

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to enable AI analysis."
    );
  }
  return new OpenAI();
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function analyzeSite(
  siteUrl: string,
  pages: PageExtraction[]
): Promise<FullAnalysis> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const digest = buildSiteDigest(siteUrl, pages);

  const understandingPromise = client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content:
          "You evaluate how well AI assistants (ChatGPT, Claude, Gemini, Perplexity) can understand a business from its website. You are blunt and specific. Confidence is 0-100: how confidently an AI assistant could answer 'what does this company do, for whom, where, and why choose them' using ONLY this site's content. Also produce a semantic map: the single primary topic and its subtopics (concepts, not page names). List concrete problems that lower confidence (e.g. 'No page states the service area').",
      },
      { role: "user", content: digest },
    ],
    text: { format: zodTextFormat(understandingSchema, "understanding") },
  });

  const geoPromise = client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: `You are a GEO (Generative Engine Optimization) auditor. Score this website 0-100 on EACH of these components, exactly once each: ${GEO_COMPONENT_NAMES.join(", ")}.
Scoring guidance:
- Authority: expertise demonstrated, credentials, depth vs thin marketing copy.
- Topic Coverage: does it cover the full topic space of its niche?
- Entity Coverage: are people, services, products, locations named explicitly?
- Structured Data: JSON-LD presence and richness (see STRUCTURED DATA TYPES lines).
- FAQ Quality: real questions users would ask, with direct answers.
- Citations: links to or from reputable external sources.
- Trust Signals: contact info, address, reviews, policies.
- Author Signals: named authors with credentials.
- Original Research: unique data, statistics, case results.
- Freshness: publication/update dates, current content.
- Machine Readability: clear headings, semantic structure, extractable answers.
- Semantic Depth: definitions, explanations, related-concept coverage.
- Conversation Readiness: content phrased so an AI can quote it as a direct answer.
For each: 1-3 sentence findings grounded in the digest, and one specific quickWin.`,
      },
      { role: "user", content: digest },
    ],
    text: { format: zodTextFormat(geoSchema, "geo_score") },
  });

  const gapsRecsPromise = client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content:
          "You find AI content gaps and produce GEO recommendations for this website. contentGaps: 6-12 realistic questions users would ask ChatGPT/Claude/Perplexity about this business's domain that this website CANNOT currently answer (cost, timelines, comparisons, outcomes, process). recommendations: 5-10 specific, non-generic actions (e.g. 'Add a pricing FAQ answering: How much does X cost?', 'Add a comparison page: why choose us over Y'). Never suggest keyword stuffing. Each recommendation names the exact page/content to create or change.",
      },
      { role: "user", content: digest },
    ],
    text: { format: zodTextFormat(gapsRecsSchema, "gaps_and_recommendations") },
  });

  const [understandingRes, geoRes, gapsRecsRes] = await Promise.all([
    understandingPromise,
    geoPromise,
    gapsRecsPromise,
  ]);

  const u = understandingRes.output_parsed;
  const g = geoRes.output_parsed;
  const gr = gapsRecsRes.output_parsed;
  if (!u || !g || !gr) throw new Error("AI analysis returned incomplete output.");

  // De-dupe / order components and compute the overall score.
  const byName = new Map(g.components.map((c) => [c.name, c]));
  const components = GEO_COMPONENT_NAMES.filter((n) => byName.has(n)).map(
    (n) => ({ ...byName.get(n)!, score: clamp(byName.get(n)!.score) })
  );
  const overall = clamp(
    components.reduce((sum, c) => sum + c.score, 0) / Math.max(components.length, 1)
  );

  return {
    understanding: {
      businessSummary: u.businessSummary,
      confidence: clamp(u.confidence),
      audience: u.audience,
      serviceArea: u.serviceArea,
      differentiators: u.differentiators,
      problems: u.problems,
    },
    semanticMap: u.semanticMap,
    geoScore: { overall, components },
    contentGaps: gr.contentGaps,
    recommendations: gr.recommendations,
  };
}
