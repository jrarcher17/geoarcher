import type { ProspectProblem } from "./analyze";

export function displayDomain(urlOrDomain: string): string {
  const raw = urlOrDomain.trim();
  try {
    const host = raw.includes("://") ? new URL(raw).hostname : raw;
    return host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw
      .replace(/^www\./i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }
}

const SUBJECT_VARIANTS = [
  (name: string) => `Google & AI may not understand ${name}`,
  (name: string) => `Google and AI may not be finding ${name}`,
  (name: string) => `AI assistants may be missing ${name}`,
  (name: string) => `${name} may be hard for Google and AI to see`,
  (name: string) => `Google & ChatGPT may not understand ${name}`,
  (name: string) => `Search and AI may be skipping ${name}`,
] as const;

/** Stable per company so regenerating a draft keeps the same subject. */
export function pickOutreachSubject(companyName: string): string {
  const name = companyName.trim() || "your company";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % SUBJECT_VARIANTS.length;
  }
  return SUBJECT_VARIANTS[hash]!(name);
}

const SEO_EXAMPLES: Record<string, string> = {
  "seo-https": "some pages are still served over plain HTTP",
  "seo-http-errors": "some pages returned errors when I crawled them",
  "seo-missing-titles": "some pages have no title tags",
  "seo-missing-descriptions": "some pages have no meta descriptions",
  "seo-duplicate-titles": "several pages share the same title",
  "seo-duplicate-descriptions": "several pages share the same meta description",
  "seo-missing-h1": "some pages have no H1 heading",
  "seo-multiple-h1": "some pages have more than one H1",
  "seo-canonical-issues": "some pages have missing or conflicting canonical tags",
  "seo-noindex-pages": "some crawled pages are marked noindex",
  "seo-orphan-pages": "some pages aren't linked from anywhere else on the site",
  "seo-thin-content": "several pages have very little written content",
  "seo-slow-pages": "some pages were slow to load when I crawled them",
  "seo-schema-coverage": "most pages have no structured data",
  "seo-org-schema": "the site has no Organization or WebSite schema",
};

function exampleFromProblem(
  problem: ProspectProblem,
  pagesCrawled: number
): string | null {
  if (problem.id === "geo-failing-score") return null;
  if (SEO_EXAMPLES[problem.id]) return SEO_EXAMPLES[problem.id];

  if (problem.id === "geo-no-structured-data") {
    return "I couldn't find JSON-LD structured data on the site";
  }

  if (problem.id === "geo-missing-meta") {
    const match = problem.title.match(/(\d+)\s+of\s+(\d+)/i);
    if (match && match[1] === match[2]) {
      return `none of the ${match[2]} pages I checked have meta descriptions`;
    }
    if (match) {
      return `${match[1]} of the ${match[2]} pages I checked have no meta descriptions`;
    }
    const n = pagesCrawled || "the";
    return `most of the ${n} pages I checked have no meta descriptions`;
  }

  if (problem.id === "geo-no-faq") {
    return "there's no FAQ content for AI assistants to quote";
  }

  if (problem.id === "geo-thin-content") {
    return problem.title.replace(/^Thin content:\s*/i, "").toLowerCase();
  }

  if (problem.id === "geo-placeholder-pages") {
    return problem.title.charAt(0).toLowerCase() + problem.title.slice(1);
  }

  if (problem.id === "geo-no-contact") {
    return "I couldn't find a public phone number or email on the site";
  }

  if (problem.id === "geo-no-reviews") {
    return "the site has no review markup";
  }

  if (problem.id === "geo-no-freshness") {
    return "pages don't show when they were last updated";
  }

  const title = problem.title.trim();
  if (!title || title.length < 12 || title === title.toUpperCase()) return null;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

export function pickProblemExamples(
  problems: ProspectProblem[],
  pagesCrawled: number
): string[] {
  const rank = (problem: ProspectProblem) => {
    const severity =
      problem.severity === "critical" ? 0 : problem.severity === "warning" ? 1 : 2;
    const geoFirst = problem.id.startsWith("geo-") ? 0 : 1;
    return severity * 10 + geoFirst;
  };
  const ranked = [...problems].sort((a, b) => rank(a) - rank(b));
  const out: string[] = [];
  for (const problem of ranked) {
    const line = exampleFromProblem(problem, pagesCrawled);
    if (line) out.push(line);
    if (out.length >= 2) break;
  }
  return out;
}

function examplesSentence(examples: string[]): string {
  if (examples.length === 0) {
    return "For example, the site is missing basic signals Google and AI assistants use to understand a business.";
  }
  if (examples.length === 1) {
    return `For example, ${examples[0]}.`;
  }
  return `For example, ${examples[0]}, and ${examples[1]}.`;
}

export function greetingName(contactName?: string | null): string {
  const first = contactName?.trim().split(/\s+/)[0] ?? "";
  if (!first || first.length < 2 || first.includes("@") || /^there$/i.test(first)) {
    return "there";
  }
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export interface OutreachDraftInput {
  companyName: string;
  domain: string;
  siteUrl?: string | null;
  senderName: string;
  contactName?: string | null;
  pagesCrawled?: number;
  problems?: ProspectProblem[];
  reportUrl: string;
  followUpIndex?: number;
}

export function buildOutreachDraft(input: OutreachDraftInput): {
  subject: string;
  body: string;
} {
  const company = input.companyName.trim() || "your company";
  const domain = displayDomain(input.siteUrl || input.domain);
  const sender = input.senderName.trim() || "John";
  const hi = `Hi ${greetingName(input.contactName)},`;
  const subject = pickOutreachSubject(company);
  const followUp = input.followUpIndex ?? 0;

  if (followUp === 1) {
    return {
      subject,
      body: [
        hi,
        "",
        `I sent a short note about how Google and AI assistants see ${company}. The free report is still here:`,
        "",
        input.reportUrl,
        "",
        `If you'd like, reply "send it" and I'll point out the 3 highest-impact things I'd fix first.`,
        "",
        sender,
      ].join("\n"),
    };
  }

  if (followUp >= 2) {
    return {
      subject,
      body: [
        hi,
        "",
        `Last note from me — I crawled ${domain} and put the findings in this report:`,
        "",
        input.reportUrl,
        "",
        `Happy to point out what I'd fix first if useful. If this isn't a priority, no worries.`,
        "",
        sender,
      ].join("\n"),
    };
  }

  const examples = pickProblemExamples(
    input.problems ?? [],
    input.pagesCrawled ?? 0
  );

  return {
    subject,
    body: [
      hi,
      "",
      `I crawled ${domain} and found a few issues that could be limiting how easily Google and AI assistants understand and surface ${company}.`,
      "",
      examplesSentence(examples),
      "",
      "Those are relatively straightforward fixes, but they can make a difference in how your company and services are understood in search results and AI-generated answers.",
      "",
      "I put together a free personalized report showing the specific pages and opportunities:",
      "",
      input.reportUrl,
      "",
      `If you'd like, reply "send it" and I'll point out the 3 highest-impact things I'd fix first.`,
      "",
      sender,
    ].join("\n"),
  };
}
