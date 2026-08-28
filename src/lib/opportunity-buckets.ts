export const OPPORTUNITY_BUCKETS = [
  "AI Visibility",
  "Content",
  "Technical SEO",
  "Structured Data",
  "Internal Linking",
] as const;

export type OpportunityBucket = (typeof OPPORTUNITY_BUCKETS)[number];

export function bucketSeoCategory(category: string): OpportunityBucket {
  const c = category.toUpperCase();
  if (c === "GEO" || c === "SEARCH") return "AI Visibility";
  if (c === "CONTENT" || c === "NEW_TOOL") return "Content";
  if (c === "SCHEMA") return "Structured Data";
  if (c === "INTERNAL_LINK") return "Internal Linking";
  return "Technical SEO";
}

export function explainVisibility(score: number | null): string {
  if (score == null) {
    return "AI visibility has not been measured yet. Run a visibility scan after your site is analyzed.";
  }
  if (score >= 75) {
    return "AI systems are likely to understand and mention this business for relevant questions.";
  }
  if (score >= 50) {
    return "AI systems sometimes understand the business, but competitors can still appear first.";
  }
  return "Your site is rarely mentioned when AI systems answer questions related to your services.";
}
