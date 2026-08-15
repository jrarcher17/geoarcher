import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ContentGap, SemanticMap, Understanding } from "@/lib/types";
import {
  SEO_CONTENT_ACTIONS,
  SEO_CONTENT_TYPES,
  type SeoAuditComputation,
  type SeoContentPlanEntry,
} from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function getClient(): OpenAI | null {
  return process.env.OPENAI_API_KEY ? new OpenAI() : null;
}

function model(): string {
  return process.env.OPENAI_MODEL ?? "gpt-5-mini";
}

export interface SiteContext {
  siteUrl: string;
  understanding: Understanding | null;
  semanticMap: SemanticMap | null;
  contentGaps: ContentGap[];
}

function contextBlock(ctx: SiteContext): string {
  return [
    `WEBSITE: ${ctx.siteUrl}`,
    ctx.understanding
      ? `BUSINESS: ${ctx.understanding.businessSummary}\nAUDIENCE: ${ctx.understanding.audience}`
      : "",
    ctx.semanticMap
      ? `MAIN TOPIC: ${ctx.semanticMap.topic}\nSUBTOPICS: ${ctx.semanticMap.subtopics.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---- Stage: content plan (improve / expand / consolidate / create / redirect / leave) ----

const contentPlanSchema = z.object({
  entries: z.array(
    z.object({
      url: z.string(),
      action: z.enum(SEO_CONTENT_ACTIONS),
      observations: z.array(z.string()),
      improvements: z.array(z.string()),
      priority: z.number(),
    })
  ),
});

/** Pages worth sending to the content-plan stage: weakest + flagged pages. */
function notablePages(computation: SeoAuditComputation, max = 50) {
  const flagged = computation.pages.filter((p) =>
    p.issues.some((i) =>
      ["content-very-thin", "content-thin", "orphan-page", "title-duplicate"].includes(i.id)
    )
  );
  const rest = computation.pages.filter((p) => !flagged.includes(p));
  return [...flagged, ...rest.sort((a, b) => a.score - b.score)].slice(0, max);
}

export async function generateContentPlan(
  ctx: SiteContext,
  computation: SeoAuditComputation
): Promise<SeoContentPlanEntry[]> {
  const client = getClient();
  if (!client) return [];

  const pages = notablePages(computation);
  const scoreByUrl = new Map(computation.pages.map((p) => [p.url, p.score]));
  const inventory = pages
    .map((p) => {
      const issueList = p.issues.map((i) => i.message).slice(0, 6).join(" | ");
      return `${p.url}\n  title: "${p.facts.title ?? "(none)"}" · ${p.facts.wordCount} words · ${p.facts.incomingInternalLinks} incoming links · score ${p.score}\n  issues: ${issueList || "none"}`;
    })
    .join("\n");

  const response = await client.responses.parse({
    model: model(),
    input: [
      {
        role: "system",
        content: `You are GEO Archer's Content Autopilot. For each page below, decide ONE action: "improve" (page is close, fix specific weaknesses), "expand" (topic deserves substantially more depth), "consolidate" (merge into a stronger page — name it), "redirect" (page has no standalone reason to exist — name the target), "leave" (intentionally minimal or already strong; utility pages with little text are often fine), or "create" is NOT used here (only for pages that exist).

Rules:
- "observations" = facts from the provided data only (word counts, link counts, issues). Never invent traffic or rankings.
- "improvements" = 2-5 concrete, page-specific actions a writer/developer could execute. No generic advice.
- Respect page purpose: a tool or product page with 60 words may deserve "leave" or light "improve", not "expand".
- priority 0-100: how much acting on this page matters relative to the others.
- Return a verdict for EVERY page listed. Use exact URLs as given.
- Never claim guaranteed ranking outcomes; improvements "may improve" visibility.`,
      },
      { role: "user", content: `${contextBlock(ctx)}\n\nPAGES:\n${inventory}` },
    ],
    text: { format: zodTextFormat(contentPlanSchema, "content_plan") },
  });

  const parsed = response.output_parsed;
  if (!parsed) return [];
  const validUrls = new Set(computation.pages.map((p) => p.url));
  return parsed.entries
    .filter((e) => validUrls.has(e.url))
    .map((e) => ({
      url: e.url,
      action: e.action,
      currentScore: scoreByUrl.get(e.url) ?? null,
      observations: e.observations.slice(0, 6),
      improvements: e.improvements.slice(0, 6),
      priority: clamp(e.priority),
    }))
    .sort((a, b) => b.priority - a.priority);
}

// ---- Stage: internal link suggestions ----

const linkSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      fromUrl: z.string(),
      toUrl: z.string(),
      anchor: z.string(),
      relevance: z.number(),
      reason: z.string(),
    })
  ),
});

export interface LinkSuggestionDraft {
  fromUrl: string;
  toUrl: string;
  anchor: string;
  relevance: number;
  reason: string;
}

export async function generateLinkSuggestions(
  ctx: SiteContext,
  computation: SeoAuditComputation
): Promise<LinkSuggestionDraft[]> {
  const client = getClient();
  if (!client) return [];

  const needLinks = computation.pages
    .filter((p) =>
      p.issues.some((i) => i.id === "orphan-page" || i.id === "underlinked-page")
    )
    .map((p) => p.url);

  const inventory = computation.pages
    .slice(0, 200)
    .map(
      (p) =>
        `${p.url} — "${p.facts.title ?? p.facts.h1 ?? "(untitled)"}" (${p.facts.incomingInternalLinks} in / ${p.facts.internalLinksOut} out)`
    )
    .join("\n");

  const response = await client.responses.parse({
    model: model(),
    input: [
      {
        role: "system",
        content: `You are GEO Archer's Internal Linking Autopilot. Suggest 10-20 contextual internal links between pages of this site.

Rules:
- Prioritize links INTO these under-linked pages: ${needLinks.slice(0, 30).join(", ") || "(none flagged — suggest links that connect related workflows)"}
- fromUrl and toUrl MUST be exact URLs from the provided page list. Never invent URLs.
- anchor: natural 2-6 word anchor text describing the destination (e.g. "compare tanning bed levels"), not "click here".
- relevance 0-100: how topically related the two pages are and how natural the link would be for a reader.
- reason: one sentence explaining the shared user workflow or topic. Facts only.
- Only suggest links a reader would genuinely find useful. Fewer good suggestions beat many weak ones.`,
      },
      { role: "user", content: `${contextBlock(ctx)}\n\nPAGES:\n${inventory}` },
    ],
    text: { format: zodTextFormat(linkSuggestionSchema, "link_suggestions") },
  });

  const parsed = response.output_parsed;
  if (!parsed) return [];
  const validUrls = new Set(computation.pages.map((p) => p.url));
  return parsed.suggestions
    .filter(
      (s) =>
        validUrls.has(s.fromUrl) && validUrls.has(s.toUrl) && s.fromUrl !== s.toUrl
    )
    .map((s) => ({ ...s, relevance: clamp(s.relevance) }));
}

// ---- Stage: search opportunities ----

const searchOpportunitySchema = z.object({
  opportunities: z.array(
    z.object({
      keyword: z.string(),
      intent: z.enum(["informational", "commercial", "transactional", "navigational"]),
      demand: z.enum(["high", "medium", "low"]),
      competition: z.enum(["high", "medium", "low"]),
      existingUrl: z.string(),
      recommendedUrl: z.string(),
      contentType: z.enum([...SEO_CONTENT_TYPES]),
      opportunityScore: z.number(),
      reason: z.string(),
    })
  ),
});

export interface SearchOpportunityDraft {
  keyword: string;
  intent: string;
  demand: string;
  competition: string;
  existingUrl: string | null;
  recommendedUrl: string;
  contentType: string | null;
  opportunityScore: number;
  reason: string;
}

export async function generateSearchOpportunities(
  ctx: SiteContext,
  computation: SeoAuditComputation
): Promise<SearchOpportunityDraft[]> {
  const client = getClient();
  if (!client) return [];

  const inventory = computation.pages
    .slice(0, 200)
    .map((p) => `${p.url} — "${p.facts.title ?? "(no title)"}"`)
    .join("\n");

  const gaps = ctx.contentGaps
    .slice(0, 12)
    .map((g) => `- ${g.question}`)
    .join("\n");

  const response = await client.responses.parse({
    model: model(),
    input: [
      {
        role: "system",
        content: `You are GEO Archer's search opportunity engine. Identify 8-15 search topics/keywords this site could realistically target, based on its existing coverage and known content gaps.

Rules:
- demand and competition are your QUALITATIVE judgments (high/medium/low) from topic knowledge — you have NO search volume data, so never state numbers.
- existingUrl: the exact URL from the page list that currently best matches the keyword, or "" if none does.
- recommendedUrl: a URL path on this site where the content should live (existing URL to strengthen, or a sensible new path like /guides/topic-name).
- contentType: prefer functional assets (Tool, Calculator, Converter, Generator) over articles when the query has tool-oriented intent — for utility sites a working tool is usually more valuable than another article.
- opportunityScore 0-100 (Archer Opportunity Score): expected value vs effort given this site's existing related coverage. Spread scores honestly.
- reason: one or two sentences. Distinguish what you observed (existing pages, gaps) from what you infer (why this topic may attract searches).
- Keywords must be realistic queries people type, specific to this business's domain.`,
      },
      {
        role: "user",
        content: `${contextBlock(ctx)}\n\nKNOWN CONTENT GAPS:\n${gaps || "(none)"}\n\nEXISTING PAGES:\n${inventory}`,
      },
    ],
    text: { format: zodTextFormat(searchOpportunitySchema, "search_opportunities") },
  });

  const parsed = response.output_parsed;
  if (!parsed) return [];
  return parsed.opportunities.map((o) => ({
    keyword: o.keyword,
    intent: o.intent,
    demand: o.demand,
    competition: o.competition,
    existingUrl: o.existingUrl || null,
    recommendedUrl: o.recommendedUrl,
    contentType: o.contentType,
    opportunityScore: clamp(o.opportunityScore),
    reason: o.reason,
  }));
}
