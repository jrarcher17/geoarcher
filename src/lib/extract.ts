import * as cheerio from "cheerio";
import type { FaqItem, PageExtraction } from "./types";

const PHONE_RE = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function cleanText(text: string, maxLen = Infinity): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function imageSource($el: { attr: (name: string) => string | undefined }): string {
  const srcset = $el.attr("srcset") || $el.attr("data-srcset");
  if (srcset) {
    const last = srcset
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean)
      .pop();
    if (last) return last;
  }
  return (
    $el.attr("src") ||
    $el.attr("data-src") ||
    $el.attr("data-lazy-src") ||
    $el.attr("data-original") ||
    ""
  );
}

function resolveUrl(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function collectJsonLdTypes(node: unknown, types: Set<string>) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectJsonLdTypes(n, types));
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") types.add(t);
    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
    for (const value of Object.values(obj)) collectJsonLdTypes(value, types);
  }
}

function extractFaqsFromJsonLd(jsonLd: unknown[]): FaqItem[] {
  const faqs: FaqItem[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (obj["@type"] === "Question" && typeof obj.name === "string") {
      const accepted = obj.acceptedAnswer as Record<string, unknown> | undefined;
      const answer = typeof accepted?.text === "string" ? accepted.text : "";
      faqs.push({ question: obj.name, answer: cleanText(answer, 600) });
    }
    Object.values(obj).forEach(visit);
  };
  jsonLd.forEach(visit);
  return faqs;
}

export function extractPage(
  html: string,
  pageUrl: string,
  statusCode: number | null,
  loadTimeMs: number
): PageExtraction {
  const $ = cheerio.load(html);
  const origin = new URL(pageUrl).origin;

  // --- JSON-LD ---
  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).text()));
    } catch {
      // ignore malformed blocks
    }
  });
  const jsonLdTypeSet = new Set<string>();
  collectJsonLdTypes(jsonLd, jsonLdTypeSet);

  // --- headings ---
  const heads = (sel: string) =>
    $(sel)
      .map((_, el) => cleanText($(el).text(), 200))
      .get()
      .filter(Boolean);

  // --- links ---
  const internal = new Set<string>();
  const external = new Set<string>();
  $("a[href]").each((_, el) => {
    const resolved = resolveUrl($(el).attr("href") ?? "", pageUrl);
    if (!resolved) return;
    (resolved.startsWith(origin) ? internal : external).add(resolved);
  });

  // --- navigation & footer ---
  const navigationLinks = $("nav a, header a")
    .map((_, el) => cleanText($(el).text(), 80))
    .get()
    .filter(Boolean)
    .slice(0, 40);
  const footerText = cleanText($("footer").first().text(), 1500) || null;

  // --- images (src, lazy-load attrs, and the largest srcset candidate) ---
  const images = $("img")
    .map((_, el) => ({
      src: imageSource($(el)),
      alt: $(el).attr("alt") ?? null,
    }))
    .get()
    .filter((img) => img.src);
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  if (ogImage) {
    images.unshift({
      src: ogImage,
      alt: $('meta[property="og:title"]').attr("content")?.trim() || "Open Graph image",
    });
  }
  const imagesMissingAlt = images.filter((img) => !img.alt?.trim()).length;

  // --- FAQs: JSON-LD FAQPage + <details>/<summary> ---
  const faqs = extractFaqsFromJsonLd(jsonLd);
  $("details").each((_, el) => {
    const q = cleanText($(el).find("summary").first().text(), 300);
    const a = cleanText(
      $(el).clone().children("summary").remove().end().text(),
      600
    );
    if (q && a) faqs.push({ question: q, answer: a });
  });

  // --- main content (main/article, else body minus chrome) ---
  const contentRoot = $("main").length
    ? $("main")
    : $("article").length
      ? $("article")
      : $("body").clone().find("nav, header, footer, script, style, noscript").remove().end();
  const mainContent = cleanText(contentRoot.text(), 8000);

  // --- contact info ---
  const phones = new Set<string>();
  const emails = new Set<string>();
  $('a[href^="tel:"]').each((_, el) => {
    phones.add(($(el).attr("href") ?? "").replace("tel:", "").trim());
  });
  $('a[href^="mailto:"]').each((_, el) => {
    emails.add(($(el).attr("href") ?? "").replace("mailto:", "").split("?")[0].trim());
  });
  const contactZone = `${footerText ?? ""} ${cleanText($("body").text(), 20000)}`;
  (contactZone.match(EMAIL_RE) ?? []).slice(0, 5).forEach((e) => emails.add(e));
  ((footerText ?? "").match(PHONE_RE) ?? []).slice(0, 5).forEach((p) => phones.add(p.trim()));

  // --- author & dates ---
  const author =
    $('meta[name="author"]').attr("content") ??
    cleanText($('[rel="author"], .author, .byline').first().text(), 120) ??
    null;
  const publishedAt =
    $('meta[property="article:published_time"]').attr("content") ??
    $("time[datetime]").first().attr("datetime") ??
    null;
  const modifiedAt =
    $('meta[property="article:modified_time"]').attr("content") ?? null;

  const hasReviewMarkup =
    jsonLdTypeSet.has("Review") ||
    jsonLdTypeSet.has("AggregateRating") ||
    $('[itemtype*="Review"]').length > 0;

  return {
    url: pageUrl,
    statusCode,
    loadTimeMs,
    title: cleanText($("title").first().text(), 300) || null,
    metaDescription: $('meta[name="description"]').attr("content")?.trim() ?? null,
    canonicalUrl: $('link[rel="canonical"]').attr("href") ?? null,
    metaRobots:
      $('meta[name="robots"], meta[name="googlebot"]').attr("content")?.trim().toLowerCase() ??
      null,
    headings: { h1: heads("h1"), h2: heads("h2"), h3: heads("h3") },
    mainContent,
    wordCount: mainContent ? mainContent.split(/\s+/).length : 0,
    navigationLinks,
    footerText,
    internalLinks: [...internal].slice(0, 500),
    externalLinks: [...external].slice(0, 100),
    images: images.slice(0, 100),
    imagesMissingAlt,
    faqs: faqs.slice(0, 50),
    tableCount: $("table").length,
    jsonLdTypes: [...jsonLdTypeSet],
    jsonLd,
    contact: { phones: [...phones].slice(0, 5), emails: [...emails].slice(0, 5) },
    hasReviewMarkup,
    author: author || null,
    publishedAt,
    modifiedAt,
  };
}
