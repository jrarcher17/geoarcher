import type {
  AdIntelligenceProvider,
  AdSearchResult,
  AdvertiserSearchResult,
  ProviderCapability,
} from "./types";

const UNAVAILABLE =
  "Google has no official API for commercial Ads Transparency Center data. The only official feed is the political-ads BigQuery dataset, which is not competitor commercial advertising. We will not scrape adstransparency.google.com.";

function capability(): ProviderCapability {
  return {
    id: "google_ads_transparency",
    name: "Google Ads Transparency",
    platform: "google",
    status: "unavailable",
    coverage: UNAVAILABLE,
    setup: null,
  };
}

function blocked(): AdSearchResult {
  return { status: "unavailable", ads: [], reason: UNAVAILABLE };
}

function blockedAdvertisers(): AdvertiserSearchResult {
  return { status: "unavailable", advertisers: [], reason: UNAVAILABLE };
}

export const googleTransparencyProvider: AdIntelligenceProvider = {
  id: "google_ads_transparency",
  name: "Google Ads Transparency",
  platform: "google",
  capability,
  async searchAds() {
    return blocked();
  },
  async searchAdvertisers() {
    return blockedAdvertisers();
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
