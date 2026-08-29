import type {
  AdIntelligenceProvider,
  AdSearchQuery,
  AdSearchResult,
  AdvertiserSearchResult,
  DiscoveredAd,
  ProviderCapability,
} from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

export function metaAdLibraryToken(): string | null {
  const token = process.env.META_AD_LIBRARY_ACCESS_TOKEN?.trim();
  return token || null;
}

export function metaAdLibraryCountries(): string[] {
  const raw = process.env.META_AD_LIBRARY_COUNTRIES?.trim();
  if (!raw) return ["GB"];
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}

function capability(): ProviderCapability {
  const ready = Boolean(metaAdLibraryToken());
  return {
    id: "meta_ad_library",
    name: "Meta Ad Library",
    platform: "meta",
    status: ready ? "ready" : "not_configured",
    coverage:
      "Official Graph ads_archive API. Commercial ads are returned for ads delivered in the EU and UK. US-only searches are limited to political and issue ads. We only store fields Meta actually returns.",
    setup: ready
      ? null
      : "Set META_AD_LIBRARY_ACCESS_TOKEN (and optional META_AD_LIBRARY_COUNTRIES, default GB) then restart the server.",
  };
}

interface ArchiveAd {
  id?: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_snapshot_url?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
}

function mapAd(row: ArchiveAd): DiscoveredAd | null {
  if (!row.id) return null;
  const snapshot = row.ad_snapshot_url?.trim() || null;
  return {
    providerId: "meta_ad_library",
    platform: "meta",
    externalId: row.id,
    advertiserName: row.page_name?.trim() || null,
    headline: row.ad_creative_link_titles?.[0]?.trim() || null,
    primaryText: row.ad_creative_bodies?.[0]?.trim() || null,
    cta: row.ad_creative_link_captions?.[0]?.trim() || null,
    landingPage: null,
    creativeUrl: snapshot,
    format: row.publisher_platforms?.join(", ") || null,
    firstSeen: row.ad_delivery_start_time?.trim() || null,
    lastSeen: row.ad_delivery_stop_time?.trim() || null,
    sourceUrl: snapshot,
    publisherPlatforms: row.publisher_platforms ?? [],
  };
}

function searchTerm(query: AdSearchQuery): string | null {
  const parts = [
    query.advertiserName,
    ...query.searchTerms,
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  if (parts.length === 0) return null;
  return parts.join(" ").slice(0, 100);
}

async function fetchArchive(query: AdSearchQuery): Promise<AdSearchResult> {
  const token = metaAdLibraryToken();
  if (!token) {
    return {
      status: "not_configured",
      ads: [],
      reason: capability().setup ?? undefined,
    };
  }

  const term = searchTerm(query);
  if (!term) {
    return { status: "error", ads: [], reason: "A search term is required." };
  }

  const countries = (query.countries.length > 0
    ? query.countries
    : metaAdLibraryCountries()
  ).slice(0, 10);

  const url = new URL(`${GRAPH}/ads_archive`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("search_terms", term);
  url.searchParams.set("ad_reached_countries", JSON.stringify(countries));
  url.searchParams.set("ad_active_status", "ACTIVE");
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("limit", String(Math.min(query.limit ?? 25, 50)));
  url.searchParams.set(
    "fields",
    [
      "id",
      "page_id",
      "page_name",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_creative_link_captions",
      "ad_creative_link_descriptions",
      "ad_snapshot_url",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "publisher_platforms",
    ].join(",")
  );

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as {
    data?: ArchiveAd[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      status: "error",
      ads: [],
      reason: json.error?.message ?? "Meta Ad Library request failed.",
    };
  }

  const ads = (json.data ?? [])
    .map(mapAd)
    .filter((a): a is DiscoveredAd => a != null);
  return { status: "ready", ads };
}

export const metaAdLibraryProvider: AdIntelligenceProvider = {
  id: "meta_ad_library",
  name: "Meta Ad Library",
  platform: "meta",
  capability,
  searchAds: fetchArchive,
  async searchAdvertisers(query) {
    const result = await fetchArchive(query);
    if (result.status !== "ready") {
      return {
        status: result.status,
        advertisers: [],
        reason: result.reason,
      };
    }
    const seen = new Set<string>();
    const advertisers = [];
    for (const ad of result.ads) {
      const key = (ad.advertiserName ?? ad.externalId).toLowerCase();
      if (seen.has(key) || !ad.advertiserName) continue;
      seen.add(key);
      advertisers.push({
        providerId: "meta_ad_library",
        platform: "meta" as const,
        name: ad.advertiserName,
        externalId: ad.externalId,
      });
    }
    return { status: "ready", advertisers };
  },
  async getAdDetails() {
    return null;
  },
  async getAdCreative() {
    return null;
  },
  async getLandingPage() {
    return null;
  },
};
