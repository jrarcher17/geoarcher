import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { extractPage } from "./extract";
import type { PageExtraction } from "./types";

const SKIP_EXTENSIONS =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|mp4|mp3|zip|gz|xml|txt|woff2?)(\?|$)/i;

const BOT_UA = "GEOArcherBot/0.1 (+https://geoarcher.app)";

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

async function fetchText(url: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": BOT_UA,
        Accept: "application/xml,text/xml,text/html,text/plain,*/*",
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

  // Try both www and apex for robots/sitemap — hosts often redirect one way.
  const hostVariants = [origin];
  try {
    const u = new URL(origin);
    if (u.hostname.startsWith("www.")) {
      u.hostname = u.hostname.slice(4);
    } else {
      u.hostname = `www.${u.hostname}`;
    }
    hostVariants.push(u.origin);
  } catch {
    /* ignore */
  }

  for (const base of hostVariants) {
    const robots = await fetchText(`${base}/robots.txt`);
    if (robots) {
      for (const line of robots.split(/\r?\n/)) {
        const m = line.match(/^\s*sitemap:\s*(.+?)\s*$/i);
        if (m?.[1]) candidates.push(m[1].trim());
      }
    }
    candidates.push(
      `${base}/sitemap.xml`,
      `${base}/sitemap_index.xml`,
      `${base}/wp-sitemap.xml`
    );
  }

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

  for (const candidate of [...new Set(candidates)]) {
    await ingestSitemap(candidate, 0);
    if (found.length >= maxUrls) break;
  }

  console.info(
    `[crawler] sitemap discovery for ${origin}: ${found.length} URL(s) from ${seenSitemaps.size} sitemap file(s)`
  );
  return found;
}

/**
 * Browserless rejects timeouts above the plan max (hobby = 60_000ms / 1 minute).
 * Override with BROWSERLESS_MAX_SESSION_MS if your plan allows longer.
 */
function browserlessMaxSessionMs(): number {
  const fromEnv = Number(process.env.BROWSERLESS_MAX_SESSION_MS ?? 60_000);
  if (!Number.isFinite(fromEnv) || fromEnv < 1) return 60_000;
  return Math.min(Math.floor(fromEnv), 900_000);
}

/** Clamp/set session timeout so connect doesn't 400 on plan limits. */
function withBrowserlessSessionTimeout(wsUrl: string): string {
  try {
    const u = new URL(wsUrl);
    const maxMs = browserlessMaxSessionMs();
    const existing = Number(u.searchParams.get("timeout") ?? 0);
    const next =
      Number.isFinite(existing) && existing >= 1
        ? Math.min(Math.floor(existing), maxMs)
        : maxMs;
    u.searchParams.set("timeout", String(next));
    return u.toString();
  } catch {
    return wsUrl;
  }
}

/**
 * Browserless uses two protocols:
 * - CDP: `/chrome`, `/chromium`, `/` → playwright.chromium.connectOverCDP()
 * - Playwright native: `/chromium/playwright` → playwright.chromium.connect()
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

async function openBrowser(): Promise<{ browser: Browser; via: "browserless" | "local" }> {
  const ws = process.env.BROWSERLESS_WS_URL?.trim();
  const isDev = process.env.NODE_ENV === "development";
  const forceLocal = process.env.FORCE_LOCAL_BROWSER === "true";
  const useBrowserlessInDev = process.env.BROWSERLESS_IN_DEV === "true";
  const tryBrowserless = Boolean(ws) && !forceLocal && (!isDev || useBrowserlessInDev);

  if (tryBrowserless && ws) {
    try {
      const browser = await connectBrowserless(withBrowserlessSessionTimeout(ws));
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

function looksLikeChallengeOrEmpty(html: string): boolean {
  if (html.length < 400) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes("just a moment") ||
    lower.includes("cf-browser-verification") ||
    lower.includes("attention required") ||
    lower.includes("enable javascript and cookies")
  );
}

async function fetchHtmlHttp(
  url: string
): Promise<{ html: string; statusCode: number; loadTimeMs: number } | null> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": BOT_UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timer);
    const statusCode = res.status;
    if (statusCode >= 400) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (
      ct &&
      !ct.includes("text/html") &&
      !ct.includes("application/xhtml") &&
      !ct.includes("text/plain")
    ) {
      return null;
    }
    const html = await res.text();
    if (looksLikeChallengeOrEmpty(html)) return null;
    return { html, statusCode, loadTimeMs: Date.now() - t0 };
  } catch {
    return null;
  }
}

async function fetchHtmlBrowser(
  page: Page,
  url: string
): Promise<{ html: string; statusCode: number; loadTimeMs: number } | null> {
  const t0 = Date.now();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    const statusCode = response?.status() ?? null;
    if (statusCode !== null && statusCode >= 400) return null;
    await page.waitForTimeout(400);
    const html = await page.content();
    if (looksLikeChallengeOrEmpty(html)) return null;
    return {
      html,
      statusCode: statusCode ?? 200,
      loadTimeMs: Date.now() - t0,
    };
  } catch (err) {
    console.warn(`[crawler] browser failed ${url}:`, err);
    return null;
  }
}

export async function crawlSite(
  startUrl: string,
  { maxPages = 15, onPage }: CrawlOptions = {}
): Promise<PageExtraction[]> {
  const start = normalizeUrl(startUrl);
  if (!start) throw new Error(`Invalid start URL: ${startUrl}`);
  const origin = new URL(start).origin;

  const queue: string[] = [];
  const seen = new Set<string>();
  enqueueUrl(start, origin, seen, queue);

  // Discover sitemap BEFORE opening a browser — this is the main URL source.
  const sitemapUrls = await discoverSitemapUrls(
    origin,
    Math.max(maxPages * 5, 250)
  );
  for (const loc of sitemapUrls) {
    enqueueUrl(loc, origin, seen, queue);
  }

  if (sitemapUrls.length === 0) {
    console.warn(
      `[crawler] no sitemap URLs found for ${origin}; crawl will rely on HTML links only`
    );
  }

  // Prefer HTTP for the full crawl. Browserless hobby plans only allow 1-minute
  // sessions, so open a browser lazily and reconnect when a session expires.
  const results: PageExtraction[] = [];
  let httpOk = 0;
  let browserOk = 0;
  let failed = 0;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  async function closeBrowser() {
    await browser?.close().catch(() => undefined);
    browser = null;
    context = null;
    page = null;
  }

  async function ensureBrowserPage(): Promise<Page> {
    if (page && !page.isClosed() && browser?.isConnected()) return page;
    await closeBrowser();
    const opened = await openBrowser();
    browser = opened.browser;
    context = await browser.newContext({
      userAgent: BOT_UA,
      viewport: { width: 1366, height: 900 },
    });
    page = await context.newPage();
    return page;
  }

  try {
    while (queue.length > 0 && results.length < maxPages) {
      const url = queue.shift()!;

      // Always try fast HTTP first (sitemap + static HTML sites).
      let loaded = await fetchHtmlHttp(url);
      if (!loaded) {
        try {
          const browserPage = await ensureBrowserPage();
          loaded = await fetchHtmlBrowser(browserPage, url);
          if (loaded) {
            browserOk += 1;
          } else {
            // Session may have died mid-request — one reconnect retry.
            await closeBrowser();
            const retryPage = await ensureBrowserPage();
            loaded = await fetchHtmlBrowser(retryPage, url);
            if (loaded) browserOk += 1;
          }
        } catch (err) {
          console.warn(`[crawler] browser session error on ${url}:`, err);
          await closeBrowser();
          failed += 1;
          continue;
        }
      } else {
        httpOk += 1;
      }

      if (!loaded) {
        failed += 1;
        continue;
      }

      const extraction = extractPage(
        loaded.html,
        url,
        loaded.statusCode,
        loaded.loadTimeMs
      );
      results.push(extraction);
      await onPage?.(extraction, results.length);

      for (const link of extraction.internalLinks) {
        enqueueUrl(link, origin, seen, queue);
      }
    }

    console.info(
      `[crawler] finished ${results.length}/${maxPages} pages for ${origin} ` +
        `(discovered ${seen.size}, sitemap ${sitemapUrls.length}, http ${httpOk}, browser ${browserOk}, failed ${failed}, queue left ${queue.length})`
    );
  } finally {
    await closeBrowser();
  }

  if (results.length === 0) {
    throw new Error("Could not crawl any pages from this site.");
  }

  if (
    sitemapUrls.length >= 40 &&
    results.length < Math.min(maxPages, 40) &&
    results.length < sitemapUrls.length * 0.25
  ) {
    console.warn(
      `[crawler] low yield vs sitemap: crawled ${results.length} of ${sitemapUrls.length} sitemap URLs (cap ${maxPages})`
    );
  }

  return results;
}
