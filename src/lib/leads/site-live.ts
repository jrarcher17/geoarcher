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

function hostnameOf(websiteUrl: string, domain?: string): string | null {
  if (domain?.trim()) return domain.trim().toLowerCase().replace(/^www\./, "");
  for (const url of candidateUrls(websiteUrl, domain)) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Only skip domains that do not exist (NXDOMAIN). A slow, bot-blocked, or
 * TLS-odd host is still a prospect — the crawler decides if pages load.
 */
export async function isWebsiteReachable(
  websiteUrl: string,
  domain?: string
): Promise<boolean> {
  const host = hostnameOf(websiteUrl, domain);
  if (!host) return false;
  const { resolve4, resolve6 } = await import("node:dns/promises");
  try {
    await Promise.any([resolve4(host), resolve6(host)]);
    return true;
  } catch {
    if (host.startsWith("www.")) return false;
    try {
      await Promise.any([resolve4(`www.${host}`), resolve6(`www.${host}`)]);
      return true;
    } catch {
      return false;
    }
  }
}
