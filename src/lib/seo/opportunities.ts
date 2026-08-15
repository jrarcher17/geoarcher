import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ContentGap, SemanticMap, Understanding } from "@/lib/types";
import {
  SEO_CONTENT_TYPES,
  type SeoAuditComputation,
  type SeoOpportunityDraft,
} from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// ---- Deterministic opportunities (from observed audit data) ----

/** Archer Opportunity Score for a deterministic fix: severity base + reach. */
function deterministicScore(
  severity: "critical" | "warning",
  affected: number,
  totalPages: number
): number {
  const base = severity === "critical" ? 72 : 56;
  const reach = Math.min(1, affected / Math.max(totalPages, 1));
  return clamp(base + reach * 24 + Math.min(affected, 10));
}

export function buildDeterministicOpportunities(
  computation: SeoAuditComputation
): SeoOpportunityDraft[] {
  const drafts: SeoOpportunityDraft[] = [];
  const totalPages = computation.totals.pages;

  const affectedBy = (issueId: string) =>
    computation.pages
      .filter((p) => p.issues.some((i) => i.id === issueId))
      .map((p) => p.url);

  const add = (
    issueIds: string[],
    severity: "critical" | "warning",
    draft: Omit<
      SeoOpportunityDraft,
      "opportunityScore" | "affectedPages" | "source" | "observed"
    > & { observed: (n: number) => string }
  ) => {
    const urls = [...new Set(issueIds.flatMap(affectedBy))];
    if (urls.length === 0) return;
    drafts.push({
      ...draft,
      observed: draft.observed(urls.length),
      opportunityScore: deterministicScore(severity, urls.length, totalPages),
      affectedPages: urls.slice(0, 30),
      source: "DETERMINISTIC",
    });
  };

  add(["title-missing", "title-duplicate"], "critical", {
    category: "ON_PAGE",
    title: "Fix missing and duplicate page titles",
    description:
      "Give every page a unique, descriptive title so each page can be distinguished in search results.",
    observed: (n) => `${n} crawled pages have a missing or duplicated <title>.`,
    inferred:
      "Unique titles address a basic on-page issue that may improve how these pages are represented in search results.",
    impact: "high",
    difficulty: "low",
    contentType: null,
  });

  add(["meta-description-missing"], "warning", {
    category: "ON_PAGE",
    title: "Write meta descriptions for pages that have none",
    description:
      "Add a 50–160 character description summarizing each page's value to searchers.",
    observed: (n) => `${n} crawled pages have no meta description.`,
    inferred:
      "Descriptive snippets address a content-presentation issue that may improve search-result relevance and click-through.",
    impact: "medium",
    difficulty: "low",
    contentType: null,
  });

  add(["h1-missing"], "warning", {
    category: "ON_PAGE",
    title: "Add an H1 heading to pages missing one",
    description:
      "Each page should have exactly one H1 that states what the page is about.",
    observed: (n) => `${n} crawled pages have no H1 heading.`,
    inferred:
      "A clear H1 addresses a structural issue that may help search engines and AI assistants identify the page topic.",
    impact: "medium",
    difficulty: "low",
    contentType: null,
  });

  add(["status-error"], "critical", {
    category: "TECHNICAL",
    title: "Fix pages returning HTTP errors",
    description:
      "Repair or redirect pages that returned 4xx/5xx status codes during the crawl.",
    observed: (n) => `${n} crawled pages returned an HTTP 4xx/5xx status.`,
    inferred:
      "Removing error responses addresses a technical issue that may prevent wasted crawl budget and broken user journeys.",
    impact: "high",
    difficulty: "medium",
    contentType: null,
  });

  add(["orphan-page"], "warning", {
    category: "INTERNAL_LINK",
    title: "Link to orphan pages from related content",
    description:
      "Add contextual internal links pointing at pages that currently receive none.",
    observed: (n) =>
      `${n} crawled pages receive no internal links from any other crawled page.`,
    inferred:
      "Internal links address a discoverability issue that may help both crawlers and visitors reach these pages.",
    impact: "medium",
    difficulty: "low",
    contentType: null,
  });

  add(["content-very-thin"], "warning", {
    category: "CONTENT",
    title: "Expand very thin pages",
    description:
      "Decide for each thin page whether to expand it with substantive content, consolidate it into a stronger page, or leave it intentionally minimal (e.g. utility pages).",
    observed: (n) => `${n} crawled pages have under ~100 words of main content.`,
    inferred:
      "More substantive content addresses a depth issue that may improve how well these pages answer user queries.",
    impact: "medium",
    difficulty: "medium",
    contentType: null,
  });

  add(["very-slow-fetch"], "warning", {
    category: "PERFORMANCE",
    title: "Investigate slow-loading pages",
    description:
      "Profile pages that took over 6 seconds to fetch during the crawl and reduce server or render time.",
    observed: (n) => `${n} pages took over 6s to fetch during the crawl.`,
    inferred:
      "Faster responses address a performance issue that may improve user experience and crawl efficiency.",
    impact: "medium",
    difficulty: "medium",
    contentType: null,
  });

  add(["noindex"], "warning", {
    category: "INDEXING",
    title: "Review noindex directives",
    description:
      "Confirm each noindexed page is intentionally excluded from search engines.",
    observed: (n) => `${n} crawled pages carry a noindex robots directive.`,
    inferred:
      "If any of these pages should rank, removing the directive addresses an indexability issue blocking them entirely.",
    impact: "high",
    difficulty: "low",
    contentType: null,
  });

  // Structured data: site-level check rather than per-issue
  const schemaCheck = computation.siteChecks.find((c) => c.id === "org-schema");
  if (schemaCheck && schemaCheck.status !== "pass") {
    drafts.push({
      category: "SCHEMA",
      title: "Add Organization and WebSite structured data",
      description:
        "Publish sitewide JSON-LD identifying the organization and website so machines can read your identity directly.",
      observed: schemaCheck.detail,
      inferred:
        "Identity schema addresses a machine-readability issue that may improve how search engines and AI assistants represent the site.",
      impact: "medium",
      difficulty: "low",
      opportunityScore: 62,
      contentType: null,
      affectedPages: [],
      source: "DETERMINISTIC",
    });
  }

  return drafts;
}

// ---- AI opportunities (site-level, reuses the existing GEO analysis) ----

const aiOpportunitySchema = z.object({
  opportunities: z.array(
    z.object({
      category: z.enum(["CONTENT", "SEARCH", "NEW_TOOL", "GEO", "INTERNAL_LINK", "SCHEMA"]),
      title: z.string(),
      description: z.string(),
      observed: z.string(),
      inferred: z.string(),
      impact: z.enum(["high", "medium", "low"]),
      difficulty: z.enum(["low", "medium", "high"]),
      opportunityScore: z.number(),
      contentType: z.enum([...SEO_CONTENT_TYPES, "None"]),
      affectedPages: z.array(z.string()),
    })
  ),
});

export interface AiOpportunityContext {
  siteUrl: string;
  understanding: Understanding | null;
  semanticMap: SemanticMap | null;
  contentGaps: ContentGap[];
  pageInventory: { url: string; title: string | null; wordCount: number }[];
  auditSummary: string;
}

/** Compact digest of deterministic findings for the AI prioritization stage. */
export function summarizeAuditForAi(computation: SeoAuditComputation): string {
  const lines = [
    `Overall SEO score: ${computation.overallScore}/100`,
    ...computation.categories.map((c) => `${c.label}: ${c.score}/100`),
    "",
    "Site checks:",
    ...computation.siteChecks.map((c) => `- [${c.status}] ${c.label}: ${c.detail}`),
  ];
  return lines.join("\n");
}

export async function generateAiOpportunities(
  context: AiOpportunityContext
): Promise<SeoOpportunityDraft[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";

  const inventory = context.pageInventory
    .slice(0, 200)
    .map((p) => `${p.url} — "${p.title ?? "(no title)"}" (${p.wordCount} words)`)
    .join("\n");

  const input = [
    `WEBSITE: ${context.siteUrl}`,
    context.understanding
      ? `BUSINESS: ${context.understanding.businessSummary}\nAUDIENCE: ${context.understanding.audience}`
      : "",
    context.semanticMap
      ? `MAIN TOPIC: ${context.semanticMap.topic}\nSUBTOPICS: ${context.semanticMap.subtopics.join(", ")}`
      : "",
    context.contentGaps.length
      ? `KNOWN CONTENT GAPS (questions the site cannot answer):\n${context.contentGaps
          .slice(0, 12)
          .map((g) => `- ${g.question}`)
          .join("\n")}`
      : "",
    `DETERMINISTIC SEO AUDIT FINDINGS:\n${context.auditSummary}`,
    `CRAWLED PAGES:\n${inventory}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: `You are GEO Archer's SEO Autopilot opportunity engine. Generate 6-10 growth opportunities for this website that a deterministic checker CANNOT find: new pages/tools worth creating, existing pages worth expanding, search topics worth targeting, and GEO (AI-assistant visibility) plays.

Rules:
- "observed" must contain ONLY facts visible in the provided data (pages that exist, topics covered, gaps listed). Never invent traffic numbers, rankings, or search volumes.
- "inferred" is your reasoning about why acting may improve search or AI visibility. Frame it as possibility ("may improve"), never as a guarantee, and never claim knowledge of Google's algorithm.
- If the site is a utility/tool site, prioritize functional tools (calculators, converters, generators, validators, formatters, checkers, lookups) over articles — a working tool is often more valuable than another blog post. Use contentType for these.
- opportunityScore (0-100) is the Archer Opportunity Score reflecting expected value vs difficulty given THIS site's existing coverage and authority signals. Spread scores honestly; not everything is a 90.
- affectedPages: existing URLs from the crawl that relate to the opportunity (empty for brand-new pages).
- contentType: "None" when the opportunity is not a content asset.
- Be specific to this business. No generic advice like "create quality content".`,
      },
      { role: "user", content: input },
    ],
    text: { format: zodTextFormat(aiOpportunitySchema, "seo_opportunities") },
  });

  const parsed = response.output_parsed;
  if (!parsed) return [];

  return parsed.opportunities.map((o) => ({
    category: o.category,
    title: o.title,
    description: o.description,
    observed: o.observed,
    inferred: o.inferred,
    impact: o.impact,
    difficulty: o.difficulty,
    opportunityScore: clamp(o.opportunityScore),
    contentType: o.contentType === "None" ? null : o.contentType,
    affectedPages: o.affectedPages.slice(0, 30),
    source: "AI" as const,
  }));
}
