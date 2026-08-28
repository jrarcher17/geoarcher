export type PlanId = "free" | "pro" | "proPlus";

export interface PlanLimits {
  id: PlanId;
  label: string;
  priceLabel: string;
  sites: number | null;
  maxPagesPerScan: number;
  competitorMaxPages: number;
  scansPerMonth: number;
  /** AI Lead Generation Machine quota; 0 = not included. */
  prospectsPerMonth: number;
  /** Shown on billing cards — accurate for current product behavior. */
  visibilityFeatures: string;
}

/** Read at request time — use bracket access so Next.js won't inline at build. */
export function proPriceLabel(): string {
  const fromEnv = process.env["PRO_PRICE_LABEL"]?.trim();
  if (fromEnv) return fromEnv;
  return "$99 / mo";
}

export function proPlusPriceLabel(): string {
  const fromEnv = process.env["PRO_PLUS_PRICE_LABEL"]?.trim();
  if (fromEnv) return fromEnv;
  return "$299 / mo";
}

export function leadGenMonthlyQuota(): number {
  const n = Number(process.env["LEADGEN_MONTHLY_QUOTA"]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 500;
}

const FREE_PLAN: PlanLimits = {
  id: "free",
  label: "Free",
  priceLabel: "$0 / mo",
  sites: 1,
  maxPagesPerScan: 15,
  competitorMaxPages: 8,
  scansPerMonth: 4,
  prospectsPerMonth: 0,
  visibilityFeatures:
    "Multi-assistant visibility scores (ChatGPT, Claude, Gemini, Perplexity, Copilot)",
};

const PRO_PLAN_BASE: Omit<PlanLimits, "priceLabel"> = {
  id: "pro",
  label: "Pro",
  sites: 100,
  maxPagesPerScan: 200,
  competitorMaxPages: 200,
  scansPerMonth: 200,
  prospectsPerMonth: 0,
  visibilityFeatures:
    "Full visibility scoring, deeper crawls + continuous SEO Autopilot",
};

const PRO_PLUS_PLAN_BASE: Omit<PlanLimits, "priceLabel" | "prospectsPerMonth"> =
  {
    id: "proPlus",
    label: "Pro Plus",
    sites: 200,
    maxPagesPerScan: 400,
    competitorMaxPages: 200,
    scansPerMonth: 400,
    visibilityFeatures:
      "Everything in Pro + advertising lead generation: find businesses that need ads, score the opportunity, and create campaigns",
  };

export function getPlans(): Record<PlanId, PlanLimits> {
  return {
    free: FREE_PLAN,
    pro: {
      ...PRO_PLAN_BASE,
      priceLabel: proPriceLabel(),
    },
    proPlus: {
      ...PRO_PLUS_PLAN_BASE,
      priceLabel: proPlusPriceLabel(),
      prospectsPerMonth: leadGenMonthlyQuota(),
    },
  };
}

export function getPlanLimits(planId: PlanId): PlanLimits {
  return getPlans()[planId];
}

export function planFromDb(value: string | null | undefined): PlanId {
  if (value === "PRO_PLUS") return "proPlus";
  if (value === "PRO") return "pro";
  return "free";
}

/** Pro and Pro Plus both include every Pro feature (SEO Autopilot, etc). */
export function isPaidPlan(planId: PlanId): boolean {
  return planId !== "free";
}

/** @deprecated Import from `@/lib/utils` in client components. */
export { formatSiteLimit } from "./utils";

export function stripeConfigured(): boolean {
  return Boolean(
    process.env["STRIPE_SECRET_KEY"]?.trim() &&
      process.env["STRIPE_PRICE_ID_PRO"]?.trim()
  );
}

export function stripeProPlusConfigured(): boolean {
  return Boolean(
    process.env["STRIPE_SECRET_KEY"]?.trim() &&
      process.env["STRIPE_PRICE_ID_PRO_PLUS"]?.trim()
  );
}

export function devBillingToggleAllowed(): boolean {
  if (process.env["ALLOW_DEV_BILLING"] === "true") return true;
  return process.env.NODE_ENV === "development";
}
