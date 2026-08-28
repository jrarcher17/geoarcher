// Shapes stored as JSON on SiteIntelligence / Offering / AdOpportunity rows.

export interface BusinessProfile {
  companyName: string;
  description: string;
  industry: string;
  locations: string[];
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface MarketingAssets {
  headlines: string[];
  valueProps: string[];
  ctas: string[];
  promotions: string[];
  testimonials: string[];
  trustSignals: string[];
  usps: string[];
}

export interface OfferingDetails {
  benefits: string[];
  features: string[];
  cta: string | null;
  location: string | null;
}

export type AdChannel = "google" | "meta" | "ai";

export interface RecommendedCampaign {
  name: string;
  goal: "LEADS" | "SALES" | "TRAFFIC" | "PHONE_CALLS" | "AWARENESS";
  audience: string;
  budgetHint: string;
}

export interface SiteIntelligenceSummary {
  status: "RUNNING" | "COMPLETE" | "FAILED" | null;
  business: BusinessProfile | null;
  marketing: MarketingAssets | null;
  offeringCount: number;
  imageCount: number;
  opportunityCount: number;
}
