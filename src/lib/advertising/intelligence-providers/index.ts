import { googleTransparencyProvider } from "./google";
import { metaAdLibraryCountries, metaAdLibraryProvider } from "./meta";
import type {
  AdSearchQuery,
  AdSearchResult,
  DiscoveredAd,
  ProviderCapability,
} from "./types";

export type { DiscoveredAd, ProviderCapability } from "./types";
export { metaAdLibraryCountries, metaAdLibraryToken } from "./meta";

const PROVIDERS = [metaAdLibraryProvider, googleTransparencyProvider] as const;

export function listIntelligenceProviders(): ProviderCapability[] {
  return PROVIDERS.map((p) => p.capability());
}

export function anyIntelligenceProviderReady(): boolean {
  return PROVIDERS.some((p) => p.capability().status === "ready");
}

export function defaultSearchCountries(): string[] {
  return metaAdLibraryCountries();
}

export async function searchIntelligenceAds(
  query: AdSearchQuery
): Promise<{ results: { provider: ProviderCapability; result: AdSearchResult }[]; ads: DiscoveredAd[] }> {
  const results = [];
  const ads: DiscoveredAd[] = [];
  for (const provider of PROVIDERS) {
    const cap = provider.capability();
    if (cap.status !== "ready") {
      results.push({
        provider: cap,
        result: {
          status: cap.status,
          ads: [],
          reason: cap.setup ?? cap.coverage,
        },
      });
      continue;
    }
    const result = await provider.searchAds(query);
    results.push({ provider: cap, result });
    ads.push(...result.ads);
  }
  return { results, ads };
}
