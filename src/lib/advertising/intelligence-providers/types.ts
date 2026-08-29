/** Normalized ad returned by an official intelligence provider. Never invented. */

export type IntelligencePlatform = "meta" | "google";

export type ProviderReadiness = "ready" | "not_configured" | "unavailable";

export interface ProviderCapability {
  id: string;
  name: string;
  platform: IntelligencePlatform;
  status: ProviderReadiness;
  /** Honest coverage note shown in the UI. */
  coverage: string;
  /** What the operator must set before this provider can search. */
  setup: string | null;
}

export interface DiscoveredAd {
  providerId: string;
  platform: IntelligencePlatform;
  externalId: string;
  advertiserName: string | null;
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  landingPage: string | null;
  creativeUrl: string | null;
  format: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  sourceUrl: string | null;
  publisherPlatforms: string[];
}

export const MESSAGING_ANGLES = [
  "Pain relief",
  "Convenience",
  "Luxury",
  "Performance",
  "Scientific credibility",
  "Price",
  "Before/after",
  "Social proof",
  "Speed",
  "Portability",
  "Professional results",
] as const;

export type MessagingAngle = (typeof MESSAGING_ANGLES)[number];

/** AI recommendation for a stored library ad. Not measured performance. */
export interface LibraryAdAnalysis {
  label: "AI Recommendation";
  hook: string | null;
  problem: string | null;
  promise: string | null;
  offer: string | null;
  audience: string | null;
  creativeStrategy: string | null;
  cta: string | null;
  messagingAngle: MessagingAngle;
  strengthScore: number;
  opportunityScore: number;
  strengthRationale: string;
  opportunityRationale: string;
  missing: string[];
  groundedFields: string[];
}

export interface DiscoveredAdvertiser {
  providerId: string;
  platform: IntelligencePlatform;
  name: string;
  externalId: string | null;
}

export interface AdSearchQuery {
  searchTerms: string[];
  advertiserName?: string | null;
  countries: string[];
  limit?: number;
}

export interface AdSearchResult {
  status: ProviderReadiness | "error";
  ads: DiscoveredAd[];
  reason?: string;
}

export interface AdvertiserSearchResult {
  status: ProviderReadiness | "error";
  advertisers: DiscoveredAdvertiser[];
  reason?: string;
}

export interface AdIntelligenceProvider {
  id: string;
  name: string;
  platform: IntelligencePlatform;
  capability(): ProviderCapability;
  searchAds(query: AdSearchQuery): Promise<AdSearchResult>;
  searchAdvertisers(query: AdSearchQuery): Promise<AdvertiserSearchResult>;
  getAdDetails(externalId: string): Promise<DiscoveredAd | null>;
  getAdCreative(externalId: string): Promise<{ url: string | null } | null>;
  getLandingPage(externalId: string): Promise<{ url: string | null } | null>;
}
