import { chromium, type Browser } from "playwright";
import { extractPage } from "./extract";
import type { PageExtraction } from "./types";

const SKIP_EXTENSIONS =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|mp4|mp3|zip|gz|xml|txt|woff2?)(\?|$)/i;

const BROWSERLESS_CONNECT_MS = Number(
  process.env.BROWSERLESS_CONNECT_TIMEOUT_MS ?? 30_000
);

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    url.hash = "";
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

/** Same registrable host, ignoring www. */
function sameSite(url: string, origin: string): boolean {
  try {
    return stripWww(new URL(url).hostname) === stripWww(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Rewrite host/protocol to the crawl start origin so www/non-www don't duplicate. */
function toStartOrigin(url: string, startOrigin: string): string {
  const u = new URL(url);
  const s = new URL(startOrigin);
  u.protocol = s.protocol;
  u.host = s.host;
  return u.toString();
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "GEOArcherBot/0.1 (+https://geoarcher.app)",
        Accept: "application/xml,text/xml,text/plain,*/*",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function locsFromSitemapXml(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const loc = match[1]?.trim();
    if (loc) locs.push(loc);
  }
  return locs;
}

/**
 * Seed the crawl frontier from robots.txt + sitemap(s). Many sites only expose
 * a shallow link graph in HTML; sitemaps list the deep pages.
 */
async function discoverSitemapUrls(
  origin: string,
  maxUrls: number
): Promise<string[]> {
  const candidates: string[] = [];
  const robots = await fetchText(`${origin}/robots.txt`);
  if (robots) {
    for (const line of robots.split(/\r?\n/)) {
      const m = line.match(/^\s*sitemap:\s*(.+?)\s*$/i);
      if (m?.[1]) candidates.push(m[1].trim());
    }
  }
  candidates.push(
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`
  );

  const found: string[] = [];
  const seenSitemaps = new Set<string>();

  async function ingestSitemap(sitemapUrl: string, depth: number) {
    if (depth > 4 || found.length >= maxUrls) return;
    let normalized: string;
    try {
      normalized = new URL(sitemapUrl).toString();
    } catch {
      return;
    }
    if (seenSitemaps.has(normalized)) return;
    seenSitemaps.add(normalized);

    const xml = await fetchText(normalized);
    if (!xml || !/<loc>/i.test(xml)) return;

    const locs = locsFromSitemapXml(xml);
    const isIndex = /<sitemapindex[\s>]/i.test(xml);

    if (isIndex) {
      for (const child of locs) {
        await ingestSitemap(child, depth + 1);
        if (found.length >= maxUrls) break;
      }
      return;
    }

    for (const loc of locs) {
      found.push(loc);
      if (found.length >= maxUrls) break;
    }
  }

  for (const candidate of candidates) {
    await ingestSitemap(candidate, 0);
    if (found.length >= maxUrls) break;
  }

  if (found.length > 0) {
    console.info(
      `[crawler] seeded ${found.length} URL(s) from sitemap(s) for ${origin}`
    );
  }
  return found;
}

/**
 * Browserless uses two protocols:
 * - CDP: `/chrome`, `/chromium`, `/` → playwright.chromium.connectOverCDP()
 * - Playwright native: `/chromium/playwright` → playwright.chromium.connect()
 * Using the wrong method hangs until timeout (common with `/chrome` + connect()).
 */
async function connectBrowserless(wsUrl: string): Promise<Browser> {
  let parsed: URL;
  try {
    parsed = new URL(wsUrl);
  } catch {
    throw new Error(
      "BROWSERLESS_WS_URL is not a valid URL. Expected wss://…browserless.io/chromium?token=…"
    );
  }

  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const usePlaywrightProtocol = /\/playwright$/i.test(path);
  const timeout = Number.isFinite(BROWSERLESS_CONNECT_MS)
    ? BROWSERLESS_CONNECT_MS
    : 30_000;

  try {
    if (usePlaywrightProtocol) {
      return await chromium.connect(wsUrl, { timeout });
    }
    return await chromium.connectOverCDP(wsUrl, { timeout });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Browserless connection failed (${usePlaywrightProtocol ? "playwright" : "CDP"} via ${path}). ` +
        `For /chrome or /chromium use CDP; for /chromium/playwright use native connect. ` +
        `Also verify the token and plan concurrency.\n\n${detail}`
    );
  }
}

async function launchLocalBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    const hint =
      "Local Chromium is not installed. Run: pnpm exec playwright install chromium";
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Executable doesn't exist")) {
      throw new Error(`${hint}\n\n(${message})`);
    }
    throw err;
  }
}

/**
 * Prefer Browserless when configured.
 * In production, Browserless is required (containers usually lack Chromium).
 * Local Playwright is for development, or when FORCE_LOCAL_BROWSER=true.
 */
async function openBrowser(): Promise<{ browser: Browser; via: "browserless" | "local" }> {
  const ws = process.env.BROWSERLESS_WS_URL?.trim();
  const isDev = process.env.NODE_ENV === "development";
  const forceLocal = process.env.FORCE_LOCAL_BROWSER === "true";
  const useBrowserlessInDev = process.env.BROWSERLESS_IN_DEV === "true";
  const tryBrowserless = Boolean(ws) && !forceLocal && (!isDev || useBrowserlessInDev);

  if (tryBrowserless && ws) {
    try {
      const browser = await connectBrowserless(ws);
      console.info("[crawler] connected via Browserless");
      return { browser, via: "browserless" };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      if (!isDev) {
        throw new Error(
          `Could not connect to Browserless. Check BROWSERLESS_WS_URL and your Browserless account.\n\n${detail}`
        );
      }
      console.warn("[crawler] Browserless failed, trying local Chromium:", err);
    }
  }

  if (!isDev && !forceLocal) {
    throw new Error(
      "Crawling in production requires BROWSERLESS_WS_URL (remote Chromium). Set it in your host env, or set FORCE_LOCAL_BROWSER=true only if Chromium is installed in the image (pnpm exec playwright install --with-deps chromium)."
    );
  }

  const browser = await launchLocalBrowser();
  console.info("[crawler] using local Chromium");
  return { browser, via: "local" };
}

export interface CrawlOptions {
  maxPages?: number;
  onPage?: (page: PageExtraction, index: number) => Promise<void> | void;
}

function enqueueUrl(
  raw: string,
  startOrigin: string,
  seen: Set<string>,
  queue: string[]
): void {
  const normalized = normalizeUrl(raw);
  if (!normalized) return;
  if (!sameSite(normalized, startOrigin)) return;
  if (SKIP_EXTENSIONS.test(normalized)) return;
  const canonical = normalizeUrl(toStartOrigin(normalized, startOrigin));
  if (!canonical || seen.has(canonical)) return;
  seen.add(canonical);
  queue.push(canonical);
}

export async function crawlSite(
  startUrl: string,
  { maxPages = 15, onPage }: CrawlOptions = {}
): Promise<PageExtraction[]> {
  const { browser } = await openBrowser();

  const results: PageExtraction[] = [];
  try {
    const context = await browser.newContext({
      userAgent: "GEOArcherBot/0.1 (+https://geoarcher.app)",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();

    const start = normalizeUrl(startUrl);
    if (!start) throw new Error(`Invalid start URL: ${startUrl}`);
    const origin = new URL(start).origin;

    const queue: string[] = [];
    const seen = new Set<string>();
    enqueueUrl(start, origin, seen, queue);

    // Seed deep URLs from sitemap so we don't stop at homepage nav depth.
    const sitemapUrls = await discoverSitemapUrls(origin, Math.max(maxPages * 4, 80));
    for (const loc of sitemapUrls) {
      enqueueUrl(loc, origin, seen, queue);
    }

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
        // Give client-rendered nav/menus a moment to hydrate links.
        await page.waitForTimeout(900);
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
        enqueueUrl(link, origin, seen, queue);
      }
      await page.waitForTimeout(250);
    }

    console.info(
      `[crawler] finished ${results.length}/${maxPages} pages (${seen.size} discovered) for ${origin}`
    );
  } finally {
    await browser.close();
  }

  if (results.length === 0) {
    throw new Error("Could not crawl any pages from this site.");
  }
  return results;
}
