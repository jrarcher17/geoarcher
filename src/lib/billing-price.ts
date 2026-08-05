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

/** Pro card display price: env label, else Stripe Price, else default. */
export async function resolveProPriceLabel(): Promise<string> {
  const fromEnv = "$99 / mo";
  if (fromEnv) return fromEnv;

  const priceId = env("STRIPE_PRICE_ID_PRO");
  const stripeKey = env("STRIPE_SECRET_KEY");
  if (!priceId || !stripeKey || priceId.includes("...")) {
    return "$99 / mo";
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

  return "$49 / mo";
}
