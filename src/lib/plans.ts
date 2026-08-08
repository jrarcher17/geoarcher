export type PlanId = "free" | "pro";

export interface PlanLimits {
  id: PlanId;
  label: string;
  priceLabel: string;
  sites: number | null;
  maxPagesPerScan: number;
  competitorMaxPages: number;
  scansPerMonth: number;
  /** Shown on billing cards — accurate for current product behavior. */
  visibilityFeatures: string;
}

/** Read at request time — use bracket access so Next.js won't inline at build. */
export function proPriceLabel(): string {
  const fromEnv = process.env["PRO_PRICE_LABEL"]?.trim();
  if (fromEnv) return fromEnv;
  return "$49 / mo";
}

const FREE_PLAN: PlanLimits = {
  id: "free",
  label: "Free",
  priceLabel: "$0 / mo",
  sites: 1,
  maxPagesPerScan: 15,
  competitorMaxPages: 8,
  scansPerMonth: 4,
  visibilityFeatures:
    "Multi-assistant visibility scores (ChatGPT, Claude, Gemini, Perplexity, Copilot)",
};

const PRO_PLAN_BASE: Omit<PlanLimits, "priceLabel"> = {
  id: "pro",
  label: "Pro",
  sites: null,
  maxPagesPerScan: 200,
  competitorMaxPages: 200,
  scansPerMonth: 200,
  visibilityFeatures:
    "Full visibility scoring + deeper crawl coverage for large sites",
};

export function getPlans(): Record<PlanId, PlanLimits> {
  return {
    free: FREE_PLAN,
    pro: {
      ...PRO_PLAN_BASE,
      priceLabel: proPriceLabel(),
    },
  };
}

export function getPlanLimits(planId: PlanId): PlanLimits {
  return getPlans()[planId];
}

export function planFromDb(value: string | null | undefined): PlanId {
  return value === "PRO" ? "pro" : "free";
}

/** @deprecated Import from `@/lib/utils` in client components. */
export { formatSiteLimit } from "./utils";

export function stripeConfigured(): boolean {
  return Boolean(
    process.env["STRIPE_SECRET_KEY"]?.trim() &&
      process.env["STRIPE_PRICE_ID_PRO"]?.trim()
  );
}

export function devBillingToggleAllowed(): boolean {
  if (process.env["ALLOW_DEV_BILLING"] === "true") return true;
  return process.env.NODE_ENV === "development";
}
