import type { PageExtraction } from "@/lib/types";
import {
  SEO_CATEGORY_LABELS,
  type SeoAuditComputation,
  type SeoCategoryId,
  type SeoCategoryScore,
  type SeoIssue,
  type SeoPageAuditResult,
  type SeoPageFacts,
  type SeoSeverity,
  type SeoSiteCheck,
} from "./types";

// ---- Configurable scoring ----

/** Overall SEO score weights. Must sum to 1. Tune here, never per-site. */
export const SEO_SCORE_WEIGHTS: Record<SeoCategoryId, number> = {
  technical: 0.25,
  content: 0.2,
  onPage: 0.2,
  internalLinking: 0.1,
  performance: 0.1,
  structuredData: 0.05,
  indexability: 0.05,
  contentOpportunities: 0.05,
};

/** Page-score deduction per issue severity. */
const PAGE_DEDUCTION: Record<SeoSeverity, number> = {
  critical: 15,
  warning: 7,
  info: 3,
};

/** Category-score penalty per issue, normalized by page count. */
const CATEGORY_PENALTY: Record<SeoSeverity, number> = {
  critical: 1,
  warning: 0.45,
  info: 0.15,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// ---- URL helpers ----

function normalizeForGraph(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${u.origin.replace("://www.", "://")}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function isHomePage(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname === "/" || u.pathname === "";
  } catch {
    return false;
  }
}

// ---- Per-page fact extraction ----

interface PageInput {
  pageId: string | null;
  extracted: PageExtraction;
}

function canonicalState(
  page: PageExtraction,
  siteHost: string
): SeoPageFacts["canonicalState"] {
  if (!page.canonicalUrl) return "missing";
  try {
    const canonical = new URL(page.canonicalUrl, page.url);
    const canonicalHost = canonical.host.replace(/^www\./, "");
    if (canonicalHost !== siteHost.replace(/^www\./, "")) return "external";
    return normalizeForGraph(canonical.toString()) === normalizeForGraph(page.url)
      ? "self"
      : "internal-other";
  } catch {
    return "missing";
  }
}

function buildFacts(
  page: PageExtraction,
  siteHost: string,
  incomingCount: number
): SeoPageFacts {
  const metaRobots = page.metaRobots ?? null;
  return {
    title: page.title,
    titleLength: page.title?.length ?? 0,
    metaDescription: page.metaDescription,
    metaDescriptionLength: page.metaDescription?.length ?? 0,
    h1: page.headings.h1[0] ?? null,
    h1Count: page.headings.h1.length,
    h2Count: page.headings.h2.length,
    wordCount: page.wordCount,
    canonicalUrl: page.canonicalUrl,
    canonicalState: canonicalState(page, siteHost),
    metaRobots,
    noindex: metaRobots?.includes("noindex") ?? false,
    statusCode: page.statusCode,
    loadTimeMs: page.loadTimeMs ?? null,
    internalLinksOut: page.internalLinks.length,
    incomingInternalLinks: incomingCount,
    schemaTypes: page.jsonLdTypes,
    hasFaq: page.faqs.length > 0,
    imageCount: page.images.length,
    imagesMissingAlt: page.imagesMissingAlt,
  };
}

// ---- Per-page checks (facts in, issues out) ----

function checkPage(
  facts: SeoPageFacts,
  url: string,
  duplicateTitles: Set<string>,
  duplicateDescriptions: Set<string>
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const add = (
    id: string,
    severity: SeoSeverity,
    category: SeoCategoryId,
    message: string
  ) => issues.push({ id, severity, category, message });

  // Technical
  if (facts.statusCode != null && facts.statusCode >= 400) {
    add(
      "status-error",
      "critical",
      "technical",
      `Page returned HTTP ${facts.statusCode}.`
    );
  } else if (facts.statusCode != null && facts.statusCode >= 300) {
    add(
      "status-redirect",
      "info",
      "technical",
      `Page returned a redirect status (HTTP ${facts.statusCode}).`
    );
  }
  if (facts.canonicalState === "external") {
    add(
      "canonical-external",
      "warning",
      "technical",
      `Canonical URL points to a different domain (${facts.canonicalUrl}).`
    );
  }

  // Indexability
  if (facts.noindex) {
    add(
      "noindex",
      "warning",
      "indexability",
      `Page has a noindex robots directive ("${facts.metaRobots}").`
    );
  }
  if (facts.canonicalState === "internal-other") {
    add(
      "canonicalized-elsewhere",
      "info",
      "indexability",
      `Canonical points to a different page on this site (${facts.canonicalUrl}).`
    );
  }
  if (facts.canonicalState === "missing") {
    add(
      "canonical-missing",
      "info",
      "indexability",
      "No canonical URL is declared."
    );
  }

  // On-page: title
  if (!facts.title) {
    add("title-missing", "critical", "onPage", "Page has no <title> tag.");
  } else {
    if (duplicateTitles.has(facts.title)) {
      add(
        "title-duplicate",
        "warning",
        "onPage",
        `Title is shared with other pages ("${facts.title.slice(0, 80)}").`
      );
    }
    if (facts.titleLength < 15) {
      add(
        "title-short",
        "warning",
        "onPage",
        `Title is only ${facts.titleLength} characters.`
      );
    } else if (facts.titleLength > 60) {
      add(
        "title-long",
        "info",
        "onPage",
        `Title is ${facts.titleLength} characters (may be truncated in results).`
      );
    }
  }

  // On-page: meta description
  if (!facts.metaDescription) {
    add(
      "meta-description-missing",
      "warning",
      "onPage",
      "Page has no meta description."
    );
  } else {
    if (duplicateDescriptions.has(facts.metaDescription)) {
      add(
        "meta-description-duplicate",
        "info",
        "onPage",
        "Meta description is shared with other pages."
      );
    }
    if (facts.metaDescriptionLength < 50) {
      add(
        "meta-description-short",
        "info",
        "onPage",
        `Meta description is only ${facts.metaDescriptionLength} characters.`
      );
    } else if (facts.metaDescriptionLength > 165) {
      add(
        "meta-description-long",
        "info",
        "onPage",
        `Meta description is ${facts.metaDescriptionLength} characters (may be truncated).`
      );
    }
  }

  // On-page: headings
  if (facts.h1Count === 0) {
    add("h1-missing", "warning", "onPage", "Page has no H1 heading.");
  } else if (facts.h1Count > 1) {
    add(
      "h1-multiple",
      "info",
      "onPage",
      `Page has ${facts.h1Count} H1 headings.`
    );
  }

  // Content
  if (facts.wordCount < 100) {
    add(
      "content-very-thin",
      "warning",
      "content",
      `Main content is only ~${facts.wordCount} words.`
    );
  } else if (facts.wordCount < 250) {
    add(
      "content-thin",
      "info",
      "content",
      `Main content is ~${facts.wordCount} words.`
    );
  }
  if (facts.imageCount > 0 && facts.imagesMissingAlt > 0) {
    add(
      "images-missing-alt",
      "info",
      "content",
      `${facts.imagesMissingAlt} of ${facts.imageCount} images have no alt text.`
    );
  }

  // Internal linking
  if (facts.incomingInternalLinks === 0 && !isHomePage(url)) {
    add(
      "orphan-page",
      "warning",
      "internalLinking",
      "No other crawled page links to this page."
    );
  } else if (facts.incomingInternalLinks === 1 && !isHomePage(url)) {
    add(
      "underlinked-page",
      "info",
      "internalLinking",
      "Only one crawled page links to this page."
    );
  }
  if (facts.internalLinksOut < 3) {
    add(
      "few-outgoing-links",
      "info",
      "internalLinking",
      `Page links to only ${facts.internalLinksOut} internal pages.`
    );
  } else if (facts.internalLinksOut > 150) {
    add(
      "excessive-links",
      "info",
      "internalLinking",
      `Page links to ${facts.internalLinksOut} internal pages.`
    );
  }

  // Performance (measured fetch time during our crawl — not a Google metric)
  if (facts.loadTimeMs != null) {
    if (facts.loadTimeMs > 6000) {
      add(
        "very-slow-fetch",
        "warning",
        "performance",
        `Page took ${(facts.loadTimeMs / 1000).toFixed(1)}s to fetch during the crawl.`
      );
    } else if (facts.loadTimeMs > 3000) {
      add(
        "slow-fetch",
        "info",
        "performance",
        `Page took ${(facts.loadTimeMs / 1000).toFixed(1)}s to fetch during the crawl.`
      );
    }
  }

  // Structured data
  if (facts.schemaTypes.length === 0) {
    add(
      "no-structured-data",
      "info",
      "structuredData",
      "Page has no JSON-LD structured data."
    );
  }

  return issues;
}

// ---- Site-level checks ----

function buildSiteChecks(
  pages: SeoPageAuditResult[],
  siteUrl: string
): SeoSiteCheck[] {
  const checks: SeoSiteCheck[] = [];
  const urlsWithIssue = (issueId: string) =>
    pages.filter((p) => p.issues.some((i) => i.id === issueId)).map((p) => p.url);

  const push = (
    id: string,
    label: string,
    category: SeoCategoryId,
    affected: string[],
    detailWhenAffected: (n: number) => string,
    severityWhenAffected: "warn" | "fail" = "warn",
    passDetail = "No issues found across crawled pages."
  ) => {
    checks.push({
      id,
      label,
      category,
      status: affected.length === 0 ? "pass" : severityWhenAffected,
      detail:
        affected.length === 0 ? passDetail : detailWhenAffected(affected.length),
      affectedUrls: affected.slice(0, 50),
    });
  };

  // HTTPS — uses the URL we actually landed on after redirects, not the
  // http:// seed Apollo/sitemap may have given us.
  const insecure = pages.filter((p) => p.url.startsWith("http://")).map((p) => p.url);
  push(
    "https",
    "HTTPS",
    "technical",
    insecure,
    (n) => `${n} crawled pages were served over plain HTTP.`,
    "fail",
    "All crawled pages are served over HTTPS."
  );

  // Errors
  push(
    "http-errors",
    "HTTP errors",
    "technical",
    urlsWithIssue("status-error"),
    (n) => `${n} pages returned HTTP 4xx/5xx during the crawl.`,
    "fail"
  );

  // Titles
  push(
    "missing-titles",
    "Missing titles",
    "onPage",
    urlsWithIssue("title-missing"),
    (n) => `${n} pages have no <title> tag.`,
    "fail"
  );
  push(
    "duplicate-titles",
    "Duplicate titles",
    "onPage",
    urlsWithIssue("title-duplicate"),
    (n) => `${n} pages share a title with at least one other page.`
  );

  // Meta descriptions
  push(
    "missing-descriptions",
    "Missing meta descriptions",
    "onPage",
    urlsWithIssue("meta-description-missing"),
    (n) => `${n} pages have no meta description.`
  );
  push(
    "duplicate-descriptions",
    "Duplicate meta descriptions",
    "onPage",
    urlsWithIssue("meta-description-duplicate"),
    (n) => `${n} pages share a meta description with at least one other page.`
  );

  // H1
  push(
    "missing-h1",
    "Missing H1",
    "onPage",
    urlsWithIssue("h1-missing"),
    (n) => `${n} pages have no H1 heading.`
  );
  push(
    "multiple-h1",
    "Multiple H1s",
    "onPage",
    urlsWithIssue("h1-multiple"),
    (n) => `${n} pages have more than one H1.`
  );

  // Canonicals
  push(
    "canonical-issues",
    "Canonical tags",
    "indexability",
    [...urlsWithIssue("canonical-external"), ...urlsWithIssue("canonical-missing")],
    (n) => `${n} pages have a missing or cross-domain canonical.`
  );

  // Noindex
  push(
    "noindex-pages",
    "Noindex directives",
    "indexability",
    urlsWithIssue("noindex"),
    (n) => `${n} crawled pages carry a noindex directive.`,
    "warn",
    "No crawled page carries a noindex directive."
  );

  // Orphans
  push(
    "orphan-pages",
    "Orphan pages",
    "internalLinking",
    urlsWithIssue("orphan-page"),
    (n) => `${n} pages receive no internal links from other crawled pages.`
  );

  // Thin content
  push(
    "thin-content",
    "Thin content",
    "content",
    [...urlsWithIssue("content-very-thin"), ...urlsWithIssue("content-thin")],
    (n) => `${n} pages have under ~250 words of main content.`
  );

  // Slow pages
  push(
    "slow-pages",
    "Slow pages",
    "performance",
    [...urlsWithIssue("very-slow-fetch"), ...urlsWithIssue("slow-fetch")],
    (n) => `${n} pages took over 3s to fetch during the crawl.`
  );

  // Structured data coverage + site-identity schema
  const withSchema = pages.filter((p) => p.facts.schemaTypes.length > 0).length;
  const allTypes = new Set(pages.flatMap((p) => p.facts.schemaTypes));
  const hasOrgSchema =
    allTypes.has("Organization") || allTypes.has("LocalBusiness") || allTypes.has("WebSite");
  checks.push({
    id: "schema-coverage",
    label: "Structured data coverage",
    category: "structuredData",
    status:
      withSchema === 0 ? "fail" : withSchema < pages.length * 0.5 ? "warn" : "pass",
    detail: `${withSchema} of ${pages.length} crawled pages include JSON-LD (types found: ${
      [...allTypes].slice(0, 8).join(", ") || "none"
    }).`,
    affectedUrls: [],
  });
  checks.push({
    id: "org-schema",
    label: "Organization / WebSite schema",
    category: "structuredData",
    status: hasOrgSchema ? "pass" : "warn",
    detail: hasOrgSchema
      ? "Organization, LocalBusiness, or WebSite schema was found."
      : "No Organization, LocalBusiness, or WebSite schema was found on any crawled page.",
    affectedUrls: [],
  });

  // URL consistency
  const paths = pages
    .map((p) => {
      try {
        return new URL(p.url).pathname;
      } catch {
        return "";
      }
    })
    .filter((p) => p.length > 1);
  const withSlash = paths.filter((p) => p.endsWith("/")).length;
  const mixedSlashes = withSlash > 0 && withSlash < paths.length;
  checks.push({
    id: "trailing-slash",
    label: "Trailing slash consistency",
    category: "technical",
    status: mixedSlashes ? "warn" : "pass",
    detail: mixedSlashes
      ? `URL style is mixed: ${withSlash} paths end with "/" and ${paths.length - withSlash} do not.`
      : "Crawled URL paths use a consistent trailing-slash style.",
    affectedUrls: [],
  });
  const uppercase = pages.filter((p) => {
    try {
      return /[A-Z]/.test(new URL(p.url).pathname);
    } catch {
      return false;
    }
  });
  checks.push({
    id: "url-case",
    label: "Lowercase URLs",
    category: "technical",
    status: uppercase.length > 0 ? "warn" : "pass",
    detail:
      uppercase.length > 0
        ? `${uppercase.length} crawled URLs contain uppercase characters.`
        : "All crawled URL paths are lowercase.",
    affectedUrls: uppercase.map((p) => p.url).slice(0, 50),
  });

  void siteUrl;
  return checks;
}

// ---- Category + overall scoring ----

function scoreCategories(
  pages: SeoPageAuditResult[],
  contentGapCount: number
): SeoCategoryScore[] {
  const pageCount = Math.max(pages.length, 1);
  const penaltyByCategory = new Map<SeoCategoryId, number>();
  for (const page of pages) {
    for (const issue of page.issues) {
      penaltyByCategory.set(
        issue.category,
        (penaltyByCategory.get(issue.category) ?? 0) + CATEGORY_PENALTY[issue.severity]
      );
    }
  }

  return (Object.keys(SEO_SCORE_WEIGHTS) as SeoCategoryId[]).map((id) => {
    let score: number;
    if (id === "contentOpportunities") {
      // Derived from the existing GEO analysis's content gaps — reuse, don't re-ask.
      score = clamp(100 - contentGapCount * 6);
    } else {
      const density = (penaltyByCategory.get(id) ?? 0) / pageCount;
      score = clamp(100 * (1 - density));
    }
    return {
      id,
      label: SEO_CATEGORY_LABELS[id],
      score,
      weight: SEO_SCORE_WEIGHTS[id],
    };
  });
}

// ---- Entry point ----

/** Deterministic SEO audit over already-crawled pages. Pure function, no IO. */
export function computeSeoAudit(
  siteUrl: string,
  pages: PageInput[],
  contentGapCount: number
): SeoAuditComputation {
  const siteHost = (() => {
    try {
      return new URL(siteUrl).host;
    } catch {
      return siteUrl;
    }
  })();

  // Link graph: incoming internal link counts (normalized URLs)
  const incoming = new Map<string, number>();
  const pageKeys = new Set(pages.map((p) => normalizeForGraph(p.extracted.url)));
  for (const page of pages) {
    const from = normalizeForGraph(page.extracted.url);
    const seen = new Set<string>();
    for (const link of page.extracted.internalLinks) {
      const to = normalizeForGraph(link);
      if (to === from || seen.has(to) || !pageKeys.has(to)) continue;
      seen.add(to);
      incoming.set(to, (incoming.get(to) ?? 0) + 1);
    }
  }

  // Duplicate title/description sets
  const titleCounts = new Map<string, number>();
  const descCounts = new Map<string, number>();
  for (const page of pages) {
    const t = page.extracted.title;
    const d = page.extracted.metaDescription;
    if (t) titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
    if (d) descCounts.set(d, (descCounts.get(d) ?? 0) + 1);
  }
  const duplicateTitles = new Set(
    [...titleCounts.entries()].filter(([, n]) => n > 1).map(([t]) => t)
  );
  const duplicateDescriptions = new Set(
    [...descCounts.entries()].filter(([, n]) => n > 1).map(([d]) => d)
  );

  // Per-page audits
  const pageResults: SeoPageAuditResult[] = pages.map((page) => {
    const facts = buildFacts(
      page.extracted,
      siteHost,
      incoming.get(normalizeForGraph(page.extracted.url)) ?? 0
    );
    const issues = checkPage(
      facts,
      page.extracted.url,
      duplicateTitles,
      duplicateDescriptions
    );
    const score = clamp(
      100 - issues.reduce((sum, i) => sum + PAGE_DEDUCTION[i.severity], 0)
    );
    return { url: page.extracted.url, pageId: page.pageId, score, issues, facts };
  });

  const categories = scoreCategories(pageResults, contentGapCount);
  const overallScore = clamp(
    categories.reduce((sum, c) => sum + c.score * c.weight, 0)
  );

  const allIssues = pageResults.flatMap((p) => p.issues);
  const totals = {
    pages: pageResults.length,
    issues: allIssues.length,
    critical: allIssues.filter((i) => i.severity === "critical").length,
    warning: allIssues.filter((i) => i.severity === "warning").length,
    info: allIssues.filter((i) => i.severity === "info").length,
  };

  return {
    overallScore,
    categories,
    siteChecks: buildSiteChecks(pageResults, siteUrl),
    pages: pageResults,
    totals,
  };
}
