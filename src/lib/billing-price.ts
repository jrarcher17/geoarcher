import { proPlusPriceLabel, proPriceLabel } from "./plans";
import { getStripe } from "./stripe";

/** Dynamic key lookup so Next.js does not freeze env at build time. */
function env(key: string): string | undefined {
  const v = process.env[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function formatStripePrice(
  unitAmount: number,
  currency: string,
  interval?: string | null
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toLowerCase(),
  }).format(unitAmount / 100);
  if (interval === "month") return `${formatted} / mo`;
  if (interval === "year") return `${formatted} / yr`;
  if (interval) return `${formatted} / ${interval}`;
  return formatted;
}

type PaidPlanId = "pro" | "proPlus";

const PRICE_ENV_KEY: Record<PaidPlanId, string> = {
  pro: "STRIPE_PRICE_ID_PRO",
  proPlus: "STRIPE_PRICE_ID_PRO_PLUS",
};

function defaultLabel(plan: PaidPlanId): string {
  return plan === "proPlus" ? proPlusPriceLabel() : proPriceLabel();
}

/** Card display price: env label, else Stripe Price, else default. */
export async function resolvePlanPriceLabel(plan: PaidPlanId): Promise<string> {
  const fromEnv = env(plan === "proPlus" ? "PRO_PLUS_PRICE_LABEL" : "PRO_PRICE_LABEL");
  if (fromEnv) return fromEnv;

  const priceId = env(PRICE_ENV_KEY[plan]);
  const stripeKey = env("STRIPE_SECRET_KEY");
  if (!priceId || !stripeKey || priceId.includes("...")) {
    return defaultLabel(plan);
  }

  try {
    const price = await getStripe().prices.retrieve(priceId);
    if (price.unit_amount != null && price.currency) {
      return formatStripePrice(
        price.unit_amount,
        price.currency,
        price.recurring?.interval
      );
    }
  } catch (err) {
    console.warn("[billing] Stripe price lookup failed:", err);
  }

  return defaultLabel(plan);
}

export async function resolveProPriceLabel(): Promise<string> {
  return resolvePlanPriceLabel("pro");
}

export async function resolveProPlusPriceLabel(): Promise<string> {
  return resolvePlanPriceLabel("proPlus");
}
