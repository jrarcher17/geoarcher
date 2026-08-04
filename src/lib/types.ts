export interface FaqItem {
  question: string;
  answer: string;
}

export interface PageExtraction {
  url: string;
  statusCode: number | null;
  loadTimeMs: number;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  mainContent: string;
  wordCount: number;
  navigationLinks: string[];
  footerText: string | null;
  internalLinks: string[];
  externalLinks: string[];
  images: { src: string; alt: string | null }[];
  imagesMissingAlt: number;
  faqs: FaqItem[];
  tableCount: number;
  jsonLdTypes: string[];
  jsonLd: unknown[];
  contact: { phones: string[]; emails: string[] };
  hasReviewMarkup: boolean;
  author: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
}

// ---- Analysis result shapes (stored as JSON on the Analysis row) ----

export interface Understanding {
  businessSummary: string;
  confidence: number; // 0-100
  audience: string;
  serviceArea: string;
  differentiators: string[];
  problems: { issue: string; detail: string }[];
}

export interface SemanticMap {
  topic: string;
  subtopics: string[];
}

export const GEO_COMPONENT_NAMES = [
  "Authority",
  "Topic Coverage",
  "Entity Coverage",
  "Structured Data",
  "FAQ Quality",
  "Citations",
  "Trust Signals",
  "Author Signals",
  "Original Research",
  "Freshness",
  "Machine Readability",
  "Semantic Depth",
  "Conversation Readiness",
] as const;

export type GeoComponentName = (typeof GEO_COMPONENT_NAMES)[number];

export interface GeoComponent {
  name: GeoComponentName;
  score: number; // 0-100
  findings: string;
  quickWin: string;
}

export interface GeoScore {
  overall: number; // 0-100, computed average
  components: GeoComponent[];
}

export interface ContentGap {
  question: string;
  whyItMatters: string;
}

export interface Recommendation {
  title: string;
  why: string;
  how: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  category: string;
}

export interface ScanResult {
  id: string;
  status: "QUEUED" | "CRAWLING" | "ANALYZING" | "COMPLETE" | "FAILED";
  error: string | null;
  siteUrl: string;
  pagesCrawled: number;
  createdAt: string;
  finishedAt: string | null;
  pages: {
    url: string;
    title: string | null;
    wordCount: number;
    statusCode: number | null;
  }[];
  analysis: {
    semanticMap: SemanticMap;
    understanding: Understanding;
    geoScore: GeoScore;
    contentGaps: ContentGap[];
    recommendations: Recommendation[];
  } | null;
}
