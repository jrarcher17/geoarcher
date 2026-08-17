import { buildSiteDigest } from "@/lib/analysis";
import { crawlSite } from "@/lib/crawler";
import { computeSeoAudit } from "@/lib/seo/checks";
import type { PageExtraction } from "@/lib/types";

/**
 * Prospect analysis: a lightweight, deterministic GEO/SEO health check over a
 * small crawl (~8 pages). No AI spend here — AI runs later, only for
 * qualified prospects (report + outreach generation).
 */

export const PROSPECT_MAX_PAGES = 8;

export interface ProspectProblem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

export interface ProspectAnalysis {
  siteUrl: string;
  pagesCrawled: number;
  avgWordCount: number;
  /** Their SEO health 0-100 (higher = healthier). */
  seoScore: number;
  /** Their GEO readiness 0-100 (higher = more AI-visible). */
  geoScore: number;
  /** Trimmed content digest reused by the AI report/outreach stages. */
  digest: string;
}

export interface ProspectScoreBreakdown {
  seoGap: number;
  geoGap: number;
  criticalProblems: number;
  warningProblems: number;
}

export interface ProspectScoreResult {
  /** 0-100; higher = worse GEO/SEO = hotter lead. */
  score: number;
  breakdown: ProspectScoreBreakdown;
  problems: ProspectProblem[];
  analysis: ProspectAnalysis;
}

/** Prospects scoring at or above this become QUALIFIED (email reveal + outreach). */
export function qualifyThreshold(): number {
  const n = Number(process.env["LEADGEN_QUALIFY_THRESHOLD"]);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.floor(n) : 40;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const GEO_DEDUCTION = { critical: 25, warning: 12, info: 5 } as const;

/** Deterministic GEO signal check — mirrors what the full product audits with AI. */
function geoProblems(pages: PageExtraction[]): ProspectProblem[] {
  const problems: ProspectProblem[] = [];
  const total = pages.length;

  const withJsonLd = pages.filter((p) => p.jsonLdTypes.length > 0).length;
  if (withJsonLd === 0) {
    problems.push({
      id: "geo-no-structured-data",
      severity: "critical",
      title: "No structured data anywhere on the site",
      detail:
        "AI assistants and search engines rely on JSON-LD schema to understand who a business is, what it offers, and where. None of the pages checked have any.",
    });
  }

  const withFaq = pages.filter((p) => p.faqs.length > 0).length;
  if (withFaq === 0) {
    problems.push({
      id: "geo-no-faq",
      severity: "warning",
      title: "No FAQ content for AI assistants to quote",
      detail:
        "AI assistants preferentially quote question-and-answer content. The site has no FAQ sections, so competitors with FAQs get cited instead.",
    });
  }

  const withMeta = pages.filter((p) => (p.metaDescription ?? "").length > 0).length;
  if (withMeta < total / 2) {
    problems.push({
      id: "geo-missing-meta",
      severity: "warning",
      title: `${total - withMeta} of ${total} pages have no meta description`,
      detail:
        "Meta descriptions are the summary AI systems and search snippets fall back on. Missing ones make the site harder to represent accurately.",
    });
  }

  const avgWords =
    total > 0
      ? Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / total)
      : 0;
  if (avgWords < 300) {
    problems.push({
      id: "geo-thin-content",
      severity: "warning",
      title: `Thin content: pages average only ${avgWords} words`,
      detail:
        "AI assistants can't confidently describe or recommend a business from a few sentences per page. Thin content means low citation likelihood.",
    });
  }

  const hasContact = pages.some(
    (p) => p.contact.phones.length > 0 || p.contact.emails.length > 0
  );
  if (!hasContact) {
    problems.push({
      id: "geo-no-contact",
      severity: "warning",
      title: "No visible contact information found",
      detail:
        "Trust signals like a phone number or email address weigh into whether AI assistants recommend a business. None were found in the pages checked.",
    });
  }

  const hasReviews = pages.some((p) => p.hasReviewMarkup);
  if (!hasReviews) {
    problems.push({
      id: "geo-no-reviews",
      severity: "info",
      title: "No review markup",
      detail:
        "Review/rating schema is a strong trust signal for both AI assistants and search results. The site exposes none.",
    });
  }

  const hasFreshness = pages.some((p) => p.publishedAt || p.modifiedAt);
  if (!hasFreshness) {
    problems.push({
      id: "geo-no-freshness",
      severity: "info",
      title: "No freshness signals",
      detail:
        "No published/modified dates were found, so AI systems can't tell whether the content is current.",
    });
  }

  return problems;
}

/** Crawl, audit, and score one prospect's website. Deterministic, no AI. */
export async function analyzeProspectSite(
  websiteUrl: string
): Promise<ProspectScoreResult> {
  const pages = await crawlSite(websiteUrl, { maxPages: PROSPECT_MAX_PAGES });

  const seo = computeSeoAudit(
    websiteUrl,
    pages.map((p) => ({ pageId: null, extracted: p })),
    0
  );

  const geo = geoProblems(pages);
  const geoScore = clamp(
    100 - geo.reduce((sum, p) => sum + GEO_DEDUCTION[p.severity], 0)
  );

  // Fold in the worst deterministic SEO site checks as named problems.
  const seoProblems: ProspectProblem[] = seo.siteChecks
    .filter((c) => c.status !== "pass")
    .slice(0, 6)
    .map((c) => ({
      id: `seo-${c.id}`,
      severity: c.status === "fail" ? ("critical" as const) : ("warning" as const),
      title: c.label,
      detail: c.detail,
    }));

  const problems = [...geo, ...seoProblems];
  const seoGap = 100 - seo.overallScore;
  const geoGap = 100 - geoScore;
  const score = clamp(0.5 * seoGap + 0.5 * geoGap);

  const avgWordCount =
    pages.length > 0
      ? Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / pages.length)
      : 0;

  return {
    score,
    breakdown: {
      seoGap,
      geoGap,
      criticalProblems: problems.filter((p) => p.severity === "critical").length,
      warningProblems: problems.filter((p) => p.severity === "warning").length,
    },
    problems,
    analysis: {
      siteUrl: websiteUrl,
      pagesCrawled: pages.length,
      avgWordCount,
      seoScore: seo.overallScore,
      geoScore,
      digest: buildSiteDigest(websiteUrl, pages).slice(0, 6000),
    },
  };
}
