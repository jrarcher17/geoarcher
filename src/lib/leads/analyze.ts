import { buildSiteDigest } from "@/lib/analysis";
import { crawlSite } from "@/lib/crawler";
import { assessAdvertisingOpportunity } from "@/lib/leads/ad-opportunity";
import { computeSeoAudit } from "@/lib/seo/checks";
import { GEO_COMPONENT_NAMES, type PageExtraction } from "@/lib/types";
import { gradeFor } from "@/lib/utils";

export { qualifyThreshold } from "./qualify";

/**
 * Prospect analysis: deterministic GEO estimate on the same 0-100 scale as a
 * GEO Archer scan (higher = healthier). No AI spend here — AI runs later,
 * only for qualified prospects (report + outreach generation).
 */

export const PROSPECT_MAX_PAGES = 20;

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
  /** Estimated GEO score 0-100 (higher = healthier) — same direction as a full scan. */
  geoScore: number;
  /** Public emails found on the site (fallback when Apollo people search is blocked). */
  contactEmails?: string[];
  /** Distinct phone numbers found on crawled pages. */
  phoneCount?: number;
  /** Non-data-URI images found on crawled pages. */
  imageCount?: number;
  /** Trimmed content digest reused by the AI report/outreach stages. */
  digest: string;
}

export interface ProspectScoreBreakdown {
  seoGap: number;
  geoGap: number;
  criticalProblems: number;
  warningProblems: number;
  adOpportunityScore?: number;
}

export interface ProspectScoreResult {
  /** 0-100; higher = worse GEO = hotter lead. Equal to 100 − geoScore. */
  score: number;
  breakdown: ProspectScoreBreakdown;
  problems: ProspectProblem[];
  analysis: ProspectAnalysis;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const PLACEHOLDER_RE =
  /pictures coming soon|photos? coming soon|coming soon!?|lorem ipsum|under construction|website parked|domain is for sale|this site (?:is )?for sale|pardon our dust/i;

function avgWords(pages: PageExtraction[]): number {
  if (pages.length === 0) return 0;
  return pages.reduce((sum, p) => sum + p.wordCount, 0) / pages.length;
}

function share(pages: PageExtraction[], pred: (p: PageExtraction) => boolean): number {
  if (pages.length === 0) return 0;
  return pages.filter(pred).length / pages.length;
}

function placeholderShare(pages: PageExtraction[]): number {
  return share(
    pages,
    (p) => PLACEHOLDER_RE.test(p.mainContent) || p.wordCount < 40
  );
}

/**
 * Deterministic stand-in for the 13-component GEO audit. Same average-of-
 * components math as a full scan, without the AI call.
 */
export function estimateGeoScore(pages: PageExtraction[]): number {
  if (pages.length === 0) return 0;
  const placeholders = placeholderShare(pages);
  const words = avgWords(pages);
  const jsonLd = share(pages, (p) => p.jsonLdTypes.length > 0);
  const faqs = pages.reduce((n, p) => n + p.faqs.length, 0);
  const faqPages = share(pages, (p) => p.faqs.length > 0);
  const meta = share(pages, (p) => (p.metaDescription ?? "").length > 40);
  const h1 = share(pages, (p) => p.headings.h1.length > 0);
  const contact = pages.some(
    (p) => p.contact.phones.length > 0 || p.contact.emails.length > 0
  );
  const reviews = pages.some((p) => p.hasReviewMarkup);
  const authors = share(pages, (p) => Boolean(p.author));
  const dates = share(pages, (p) => Boolean(p.publishedAt || p.modifiedAt));
  const external = pages.reduce((n, p) => n + p.externalLinks.length, 0);
  const tables = pages.reduce((n, p) => n + p.tableCount, 0);
  const uniqueH2 = new Set(pages.flatMap((p) => p.headings.h2)).size;
  const altOk =
    pages.reduce((n, p) => n + p.images.length, 0) === 0
      ? 0.4
      : 1 -
        pages.reduce((n, p) => n + p.imagesMissingAlt, 0) /
          Math.max(
            1,
            pages.reduce((n, p) => n + p.images.length, 0)
          );

  const byName: Record<(typeof GEO_COMPONENT_NAMES)[number], number> = {
    Authority: clamp(words / 6 - placeholders * 50),
    "Topic Coverage": clamp(uniqueH2 * 4 + Math.min(words / 8, 30) - placeholders * 40),
    "Entity Coverage": clamp(
      jsonLd * 40 +
        (contact ? 20 : 0) +
        Math.min(uniqueH2 * 2, 25) -
        placeholders * 25
    ),
    "Structured Data": clamp(jsonLd * 90 + (reviews ? 10 : 0)),
    "FAQ Quality": clamp(faqPages * 50 + Math.min(faqs * 8, 40)),
    Citations: clamp(Math.min(external * 3, 70) + jsonLd * 15),
    "Trust Signals": clamp(
      (contact ? 35 : 0) + (reviews ? 30 : 0) + meta * 20 + (authors > 0 ? 10 : 0)
    ),
    "Author Signals": clamp(authors * 80 + (reviews ? 10 : 0)),
    "Original Research": clamp(Math.min(tables * 12, 50) + Math.min(words / 20, 25)),
    Freshness: clamp(dates * 85),
    "Machine Readability": clamp(h1 * 35 + meta * 25 + altOk * 30 + jsonLd * 10),
    "Semantic Depth": clamp(words / 7 + Math.min(uniqueH2 * 2, 20) - placeholders * 45),
    "Conversation Readiness": clamp(
      faqPages * 55 + Math.min(faqs * 6, 25) + meta * 15 - placeholders * 30
    ),
  };

  const values = GEO_COMPONENT_NAMES.map((name) => byName[name]);
  return clamp(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function geoProblems(pages: PageExtraction[], geoScore: number): ProspectProblem[] {
  const problems: ProspectProblem[] = [];
  const total = pages.length;
  const placeholders = placeholderShare(pages);

  if (placeholders >= 0.25) {
    problems.push({
      id: "geo-placeholder-pages",
      severity: "critical",
      title: `${Math.round(placeholders * 100)}% of checked pages are placeholders or nearly empty`,
      detail:
        "AI assistants skip or misrepresent sites full of “coming soon” copy. Those pages drag the GEO score down the same way a full GEO Archer scan does.",
    });
  }

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

  const words = Math.round(avgWords(pages));
  if (words < 300) {
    problems.push({
      id: "geo-thin-content",
      severity: "warning",
      title: `Thin content: pages average only ${words} words`,
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

  if (geoScore < 60) {
    problems.push({
      id: "geo-failing-score",
      severity: geoScore < 40 ? "critical" : "warning",
      title: `Estimated GEO score is ${geoScore} (grade ${gradeFor(geoScore)})`,
      detail:
        "This is the same 0–100 GEO scale as a GEO Archer scan. Below 60 is not a healthy site — it is a lead.",
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

  const geoScore = estimateGeoScore(pages);
  const geo = geoProblems(pages, geoScore);

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
  // Outreach need matches the product: a GEO 36 (F) is a 64 need, not “healthy”.
  const score = clamp(geoGap);

  const avgWordCount = Math.round(avgWords(pages));
  const contactEmails = [
    ...new Set(
      pages.flatMap((p) => p.contact.emails.map((e) => e.trim().toLowerCase()))
    ),
  ].filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.includes("noreply"));
  const phoneCount = new Set(pages.flatMap((p) => p.contact.phones)).size;
  const imageCount = pages.reduce(
    (n, p) =>
      n +
      p.images.filter((img) => img.src && !img.src.startsWith("data:")).length,
    0
  );

  const analysis = {
    siteUrl: websiteUrl,
    pagesCrawled: pages.length,
    avgWordCount,
    seoScore: seo.overallScore,
    geoScore,
    contactEmails,
    phoneCount,
    imageCount,
    digest: buildSiteDigest(websiteUrl, pages).slice(0, 6000),
  };
  const adOpportunity = assessAdvertisingOpportunity(analysis);

  return {
    score,
    breakdown: {
      seoGap,
      geoGap,
      criticalProblems: problems.filter((p) => p.severity === "critical").length,
      warningProblems: problems.filter((p) => p.severity === "warning").length,
      adOpportunityScore: adOpportunity.score,
    },
    problems,
    analysis,
  };
}
