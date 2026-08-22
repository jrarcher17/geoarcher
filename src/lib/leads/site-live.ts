/** Prefix stored on Prospect.error when the website is down or gone. */
export const UNREACHABLE_PREFIX = "UNREACHABLE:";

const DEAD_SITE_MARKERS = [
  "could not crawl any pages",
  "enotfound",
  "getaddrinfo",
  "err_name_not_resolved",
  "err_connection_refused",
  "econnrefused",
  "econnreset",
  "enetunreach",
  "certificate",
  "err_cert",
  "err_ssl",
  "nxdomain",
  "no such host",
  "name or service not known",
];

export function isUnreachableError(error: string | null | undefined): boolean {
  if (!error) return false;
  if (error.startsWith(UNREACHABLE_PREFIX)) return true;
  const lower = error.toLowerCase();
  return DEAD_SITE_MARKERS.some((marker) => lower.includes(marker));
}

export function isUnreachableProspect(prospect: {
  status: string;
  error?: string | null;
}): boolean {
  return isUnreachableError(prospect.error);
}

export function unreachableErrorMessage(): string {
  return `${UNREACHABLE_PREFIX} This website is down or no longer online.`;
}

function candidateUrls(websiteUrl: string, domain?: string): string[] {
  const urls: string[] = [];
  const raw = websiteUrl.trim();
  if (raw) {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(withProtocol);
      urls.push(parsed.origin);
      if (parsed.protocol === "https:") {
        urls.push(`http://${parsed.host}`);
      }
    } catch {
      // fall through to domain
    }
  }
  if (domain) {
    urls.push(`https://${domain}`, `http://${domain}`);
  }
  return [...new Set(urls)];
}

/**
 * Cheap liveness check — any HTTP response means the host is still there.
 * DNS / connection failures mean it is not a usable prospect.
 */
export async function isWebsiteReachable(
  websiteUrl: string,
  domain?: string
): Promise<boolean> {
  for (const url of candidateUrls(websiteUrl, domain)) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; GEOArcherLeadBot/1.0; +https://geoarcher.com)",
        },
      });
      if (res.status > 0) return true;
    } catch {
      // try the next candidate
    } finally {
      clearTimeout(timer);
    }
  }
  return false;
}
