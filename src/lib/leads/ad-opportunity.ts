/**
 * Advertising opportunity for a lead-gen prospect.
 *
 * Scores are deterministic and grounded in the site check (and, when present,
 * Site Intelligence). Nothing here invents traffic, spend, or performance.
 */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface AdOpportunitySignal {
  id: string;
  label: string;
  positive: boolean;
}

export interface SiteCheckFacts {
  pagesCrawled?: number;
  avgWordCount?: number;
  seoScore?: number;
  geoScore?: number;
  contactEmails?: string[];
  imageCount?: number;
  phoneCount?: number;
}

export interface IntelligenceFacts {
  offeringCount: number;
  imageCount: number;
  highOpportunityCount: number;
  mediumOpportunityCount: number;
  channels: string[];
}

export interface AdOpportunityAssessment {
  score: number;
  source: "site_check" | "intelligence";
  signals: AdOpportunitySignal[];
}

/** A reachable site with enough copy to advertise from — not a parked page. */
export function hasAdvertisingOpportunity(
  facts: SiteCheckFacts | null | undefined
): boolean {
  if (!facts) return false;
  return (facts.pagesCrawled ?? 0) >= 1 && (facts.avgWordCount ?? 0) >= 40;
}

/**
 * 0–100: higher = more reason to run ads for this business.
 * Site-check points come from the lightweight lead crawl. Intelligence
 * points are added only when a full scan has identified offerings.
 */
export function assessAdvertisingOpportunity(
  facts: SiteCheckFacts | null | undefined,
  intelligence?: IntelligenceFacts | null
): AdOpportunityAssessment {
  const signals: AdOpportunitySignal[] = [];
  let score = 0;

  const pages = facts?.pagesCrawled ?? 0;
  const words = facts?.avgWordCount ?? 0;
  const seo = facts?.seoScore;
  const geo = facts?.geoScore;
  const emails = facts?.contactEmails?.length ?? 0;
  const phones = facts?.phoneCount ?? 0;
  const crawlImages = facts?.imageCount ?? 0;

  if (pages >= 1) {
    score += 20;
    signals.push({
      id: "live-site",
      label: "Live website found",
      positive: true,
    });
  } else {
    signals.push({
      id: "no-site",
      label: "No crawlable website",
      positive: false,
    });
  }

  if (pages >= 5) {
    score += 12;
    signals.push({
      id: "pages",
      label: `${pages} pages crawled — enough to advertise from`,
      positive: true,
    });
  } else if (pages >= 2) {
    score += 6;
    signals.push({
      id: "pages-few",
      label: `${pages} pages crawled`,
      positive: true,
    });
  }

  if (words >= 300) {
    score += 14;
    signals.push({
      id: "content",
      label: "Strong website content",
      positive: true,
    });
  } else if (words >= 100) {
    score += 8;
    signals.push({
      id: "content-ok",
      label: "Enough on-page copy for ad landing pages",
      positive: true,
    });
  } else if (pages >= 1) {
    signals.push({
      id: "thin",
      label: "Thin content — weaker landing pages",
      positive: false,
    });
  }

  if (typeof seo === "number") {
    if (seo >= 60) {
      score += 10;
      signals.push({
        id: "landing",
        label: "Site is usable as a landing page",
        positive: true,
      });
    } else if (seo < 40) {
      signals.push({
        id: "landing-weak",
        label: "Landing-page quality is weak",
        positive: false,
      });
    }
  }

  if (emails > 0 || phones > 0) {
    score += 8;
    signals.push({
      id: "contact",
      label: "Contact details found on the site",
      positive: true,
    });
  }

  if (crawlImages >= 4) {
    score += 8;
    signals.push({
      id: "images",
      label: `${crawlImages} images found on the site`,
      positive: true,
    });
  } else if (crawlImages >= 1) {
    score += 4;
    signals.push({
      id: "images-few",
      label: `${crawlImages} image${crawlImages === 1 ? "" : "s"} found`,
      positive: true,
    });
  }

  if (typeof geo === "number" && geo < 60) {
    score += 8;
    signals.push({
      id: "visibility-gap",
      label: "Limited search/AI visibility — ads can fill the gap",
      positive: true,
    });
  }

  let source: "site_check" | "intelligence" = "site_check";

  if (
    intelligence &&
    (intelligence.offeringCount > 0 ||
      intelligence.imageCount > 0 ||
      intelligence.highOpportunityCount > 0)
  ) {
    source = "intelligence";
    if (intelligence.offeringCount > 0) {
      score += Math.min(20, intelligence.offeringCount * 4);
      signals.push({
        id: "offerings",
        label: `${intelligence.offeringCount} product${intelligence.offeringCount === 1 ? "" : "s"}/service${intelligence.offeringCount === 1 ? "" : "s"} identified`,
        positive: true,
      });
    }
    if (intelligence.imageCount > 0) {
      score += Math.min(12, intelligence.imageCount * 2);
      signals.push({
        id: "intel-images",
        label: `${intelligence.imageCount} usable image${intelligence.imageCount === 1 ? "" : "s"} for creative`,
        positive: true,
      });
    }
    if (intelligence.highOpportunityCount > 0) {
      score += Math.min(16, intelligence.highOpportunityCount * 8);
      signals.push({
        id: "high-opp",
        label: `${intelligence.highOpportunityCount} high-value advertising opportunit${intelligence.highOpportunityCount === 1 ? "y" : "ies"}`,
        positive: true,
      });
    } else if (intelligence.mediumOpportunityCount > 0) {
      score += Math.min(8, intelligence.mediumOpportunityCount * 4);
    }
    const channels = new Set(
      intelligence.channels.map((c) => c.toLowerCase())
    );
    if (channels.has("google")) {
      score += 6;
      signals.push({
        id: "google",
        label: "Strong potential for Google Search campaigns",
        positive: true,
      });
    }
    if (channels.has("meta")) {
      score += 6;
      signals.push({
        id: "meta",
        label: "Strong potential for Meta campaigns",
        positive: true,
      });
    }
  }

  return { score: clamp(score), source, signals };
}
