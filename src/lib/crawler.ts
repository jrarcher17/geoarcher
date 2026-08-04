import { chromium, type Browser } from "playwright";
import { extractPage } from "./extract";
import type { PageExtraction } from "./types";

const SKIP_EXTENSIONS =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|mp4|mp3|zip|gz|xml|txt|woff2?)(\?|$)/i;

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    url.hash = "";
    // Drop common tracking params so the same page isn't crawled twice.
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") {
        url.searchParams.delete(key);
      }
    }
    if (url.pathname.endsWith("/") && url.pathname !== "/") {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return null;
  }
}

export interface CrawlOptions {
  maxPages?: number;
  onPage?: (page: PageExtraction, index: number) => Promise<void> | void;
}

export async function crawlSite(
  startUrl: string,
  { maxPages = 15, onPage }: CrawlOptions = {}
): Promise<PageExtraction[]> {
  const browser: Browser = process.env.BROWSERLESS_WS_URL
    ? await chromium.connect(process.env.BROWSERLESS_WS_URL)
    : await chromium.launch({ headless: true });

  const results: PageExtraction[] = [];
  try {
    const context = await browser.newContext({
      userAgent: "GeoArcherBot/0.1 (+https://geoarcher.app)",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();

    const start = normalizeUrl(startUrl);
    if (!start) throw new Error(`Invalid start URL: ${startUrl}`);
    const origin = new URL(start).origin;

    const queue: string[] = [start];
    const seen = new Set<string>([start]);

    while (queue.length > 0 && results.length < maxPages) {
      const url = queue.shift()!;
      const t0 = Date.now();
      let statusCode: number | null = null;
      let html: string;
      try {
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        statusCode = response?.status() ?? null;
        // Give client-rendered sites a moment to hydrate.
        await page.waitForTimeout(700);
        html = await page.content();
      } catch (err) {
        console.warn(`[crawler] failed to load ${url}:`, err);
        continue;
      }
      const loadTimeMs = Date.now() - t0;
      if (statusCode !== null && statusCode >= 400) continue;

      const extraction = extractPage(html, url, statusCode, loadTimeMs);
      results.push(extraction);
      await onPage?.(extraction, results.length);

      for (const link of extraction.internalLinks) {
        const normalized = normalizeUrl(link);
        if (
          normalized &&
          normalized.startsWith(origin) &&
          !seen.has(normalized) &&
          !SKIP_EXTENSIONS.test(normalized)
        ) {
          seen.add(normalized);
          queue.push(normalized);
        }
      }
      // Politeness delay between requests.
      await page.waitForTimeout(300);
    }
  } finally {
    await browser.close();
  }

  if (results.length === 0) {
    throw new Error("Could not crawl any pages from this site.");
  }
  return results;
}
