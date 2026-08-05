import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureStripeCustomer } from "@/lib/billing-stripe";
import { stripeConfigured } from "@/lib/plans";
import { getServerSession } from "@/lib/session";
import { appBaseUrl, getStripe } from "@/lib/stripe";

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on this server." },
      { status: 503 }
    );
  }

  const priceId = process.env.STRIPE_PRICE_ID_PRO!.trim();
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(session.user.id);
  const base = appBaseUrl();

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/settings?tab=billing&checkout=success`,
    cancel_url: `${base}/settings?tab=billing&checkout=cancel`,
    client_reference_id: session.user.id,
    subscription_data: {
      metadata: { userId: session.user.id },
    },
    metadata: { userId: session.user.id },
  });

  if (!checkout.url) {
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: checkout.url });
}
