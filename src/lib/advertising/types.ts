// Shapes stored as JSON on SiteIntelligence / Offering / AdOpportunity rows.

export interface BusinessProfile {
  companyName: string;
  brand?: string | null;
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
  category: string | null;
  targetAudience: string[];
}

export type AdChannel = "google" | "meta" | "ai";

export interface RecommendedCampaign {
  name: string;
  goal: "LEADS" | "SALES" | "TRAFFIC" | "PHONE_CALLS" | "AWARENESS";
  audience: string;
  budgetHint: string;
}

export interface CompetitorDetails {
  similarProducts: string[];
  searchTerms: string[];
  customerProblems: string[];
  customerIntent: string[];
}

export interface CompetitorGapDetails {
  label: "AI Recommendation";
  focusedOn: string[];
  missing: string[];
  recommendedAngle: string;
  opportunityScore: number;
  groundedAdCount: number;
  advertiserNames: string[];
}

export interface AdIntelligenceScore {
  label: "AI Recommendation";
  overall: number;
  breakdown: {
    competitorCoverage: number;
    messagingOpportunity: number;
    creativeOpportunity: number;
    offerOpportunity: number;
    audienceOpportunity: number;
  };
  groundedAdCount: number;
  advertiserCount: number;
}

export interface SiteIntelligenceSummary {
  status: "RUNNING" | "COMPLETE" | "FAILED" | null;
  business: BusinessProfile | null;
  marketing: MarketingAssets | null;
  offeringCount: number;
  imageCount: number;
  opportunityCount: number;
}
