// Shared types for SEO Autopilot. Everything here is derived from the
// existing scan's crawled pages (Page.extracted) — never a second crawl.

export const SEO_CATEGORY_IDS = [
  "technical",
  "onPage",
  "content",
  "internalLinking",
  "performance",
  "structuredData",
  "indexability",
  "contentOpportunities",
] as const;

export type SeoCategoryId = (typeof SEO_CATEGORY_IDS)[number];

export const SEO_CATEGORY_LABELS: Record<SeoCategoryId, string> = {
  technical: "Technical SEO",
  onPage: "On-Page SEO",
  content: "Content Quality",
  internalLinking: "Internal Linking",
  performance: "Performance",
  structuredData: "Structured Data",
  indexability: "Indexability",
  contentOpportunities: "Content Opportunities",
};

export type SeoSeverity = "critical" | "warning" | "info";

/** One observed problem on one page. `message` states only what was observed. */
export interface SeoIssue {
  id: string;
  severity: SeoSeverity;
  category: SeoCategoryId;
  message: string;
}

/** Deterministic per-page facts extracted from the stored crawl data. */
export interface SeoPageFacts {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string | null;
  h1Count: number;
  h2Count: number;
  wordCount: number;
  canonicalUrl: string | null;
  canonicalState: "self" | "internal-other" | "external" | "missing";
  metaRobots: string | null;
  noindex: boolean;
  statusCode: number | null;
  loadTimeMs: number | null;
  internalLinksOut: number;
  incomingInternalLinks: number;
  schemaTypes: string[];
  hasFaq: boolean;
  imageCount: number;
  imagesMissingAlt: number;
}

export interface SeoPageAuditResult {
  url: string;
  pageId: string | null;
  score: number;
  issues: SeoIssue[];
  facts: SeoPageFacts;
}

/** A site-wide check result shown on the Technical SEO page. */
export interface SeoSiteCheck {
  id: string;
  label: string;
  category: SeoCategoryId;
  status: "pass" | "warn" | "fail";
  /** Observed evidence, e.g. "4 pages share the title 'Home'". */
  detail: string;
  affectedUrls: string[];
}

export interface SeoCategoryScore {
  id: SeoCategoryId;
  label: string;
  score: number;
  weight: number;
}

export interface SeoIssueTotals {
  pages: number;
  issues: number;
  critical: number;
  warning: number;
  info: number;
}

/** Full deterministic audit computation (before AI opportunities). */
export interface SeoAuditComputation {
  overallScore: number;
  categories: SeoCategoryScore[];
  siteChecks: SeoSiteCheck[];
  pages: SeoPageAuditResult[];
  totals: SeoIssueTotals;
}

// ---- Opportunities ----

export const SEO_OPPORTUNITY_CATEGORIES = [
  "TECHNICAL",
  "CONTENT",
  "ON_PAGE",
  "INTERNAL_LINK",
  "SCHEMA",
  "PERFORMANCE",
  "SEARCH",
  "COMPETITOR",
  "GEO",
  "NEW_TOOL",
  "INDEXING",
] as const;

export type SeoOpportunityCategory = (typeof SEO_OPPORTUNITY_CATEGORIES)[number];

export const SEO_OPPORTUNITY_STATUSES = [
  "NEW",
  "REVIEWED",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "DISMISSED",
] as const;

export type SeoOpportunityStatusId = (typeof SEO_OPPORTUNITY_STATUSES)[number];

export const SEO_CONTENT_TYPES = [
  "Tool",
  "Calculator",
  "Guide",
  "Comparison",
  "FAQ",
  "Reference",
  "Dictionary",
  "Template",
  "Generator",
  "Converter",
] as const;

/** An opportunity before persistence (deterministic or AI-generated). */
export interface SeoOpportunityDraft {
  category: SeoOpportunityCategory;
  title: string;
  description: string;
  /** What the crawl data shows. Facts only. */
  observed: string;
  /** Why acting on it may improve visibility. Clearly framed as inference. */
  inferred: string;
  impact: "high" | "medium" | "low";
  difficulty: "low" | "medium" | "high";
  /** Archer Opportunity Score, 0-100. Not a Google metric. */
  opportunityScore: number;
  contentType: string | null;
  affectedPages: string[];
  source: "DETERMINISTIC" | "AI";
}

// ---- Content Autopilot ----

export const SEO_CONTENT_ACTIONS = [
  "improve",
  "expand",
  "consolidate",
  "create",
  "redirect",
  "leave",
] as const;

export type SeoContentAction = (typeof SEO_CONTENT_ACTIONS)[number];

/** One entry of the content plan stored on SeoAudit.contentPlan. */
export interface SeoContentPlanEntry {
  url: string;
  action: SeoContentAction;
  currentScore: number | null;
  /** Facts from the crawl supporting the verdict. */
  observations: string[];
  /** Concrete recommended improvements (drafts only — never auto-applied). */
  improvements: string[];
  priority: number;
}

// ---- Internal linking ----

export interface SeoLinkSuggestionDto {
  id: string;
  fromUrl: string;
  toUrl: string;
  anchor: string;
  relevance: number;
  reason: string;
  status: SeoOpportunityStatusId;
}

// ---- Search opportunities ----

export interface SeoSearchOpportunityDto {
  id: string;
  keyword: string;
  intent: string;
  demand: string;
  competition: string;
  existingUrl: string | null;
  recommendedUrl: string;
  contentType: string | null;
  opportunityScore: number;
  reason: string;
  status: SeoOpportunityStatusId;
}

// ---- Rank tracking (DataForSEO) ----

export interface SeoKeywordDto {
  id: string;
  keyword: string;
  position: number | null;
  previousPosition: number | null;
  /** Your page that ranks, if any. */
  url: string | null;
  topResults: { position: number; url: string; domain: string; title: string }[];
  lastCheckedAt: string | null;
  history: { date: string; position: number | null }[];
}

export interface SeoRankingsDto {
  configured: boolean;
  keywords: SeoKeywordDto[];
  maxKeywords: number;
}

// ---- Competitor comparison ----

export interface SeoCompetitorRow {
  scanId: string;
  siteUrl: string;
  status: "QUEUED" | "CRAWLING" | "ANALYZING" | "COMPLETE" | "FAILED";
  pagesCrawled: number;
  overallScore: number | null;
  categories: SeoCategoryScore[];
}

export interface SeoCompetitorComparisonDto {
  primaryScanId: string;
  you: SeoCompetitorRow;
  competitors: SeoCompetitorRow[];
  /** Categories where a competitor outscores you meaningfully. */
  gaps: { category: string; you: number; competitor: number; competitorUrl: string }[];
  maxCompetitors: number;
}

// ---- API payload shapes ----

export interface SeoOpportunityDto extends SeoOpportunityDraft {
  id: string;
  status: SeoOpportunityStatusId;
  createdAt: string;
  updatedAt: string;
}

export interface SeoPageAuditDto {
  id: string;
  url: string;
  score: number;
  issues: SeoIssue[];
  facts: SeoPageFacts;
}

export interface SeoAuditSummaryDto {
  id: string;
  scanId: string;
  status: "RUNNING" | "COMPLETE" | "FAILED";
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  overallScore: number | null;
  categories: SeoCategoryScore[];
  siteChecks: SeoSiteCheck[];
  totals: SeoIssueTotals | null;
  pagesCrawled: number;
}

export interface SeoOverviewDto {
  siteId: string;
  siteUrl: string;
  plan: "free" | "pro";
  /** Latest complete scan available to audit, if any. */
  latestScanId: string | null;
  audit: SeoAuditSummaryDto | null;
  opportunities: SeoOpportunityDto[];
  contentPlan: SeoContentPlanEntry[];
  geoOverall: number | null;
  geoComponents: { name: string; score: number }[];
  /** SEO score over time — one point per completed audit. */
  history: { date: string; overall: number }[];
}
