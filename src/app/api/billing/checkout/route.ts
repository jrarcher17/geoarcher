import { NextResponse } from "next/server";
import {
  ensureStripeCustomer,
  syncUserPlanFromSubscription,
} from "@/lib/billing-stripe";
import { prisma } from "@/lib/db";
import { stripeConfigured, stripeProPlusConfigured } from "@/lib/plans";
import { getServerSession } from "@/lib/session";
import { appBaseUrl, getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const plan: "pro" | "proPlus" = body?.plan === "proPlus" ? "proPlus" : "pro";

  if (plan === "proPlus" ? !stripeProPlusConfigured() : !stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured for this plan on this server." },
      { status: 503 }
    );
  }

  const priceId = (
    plan === "proPlus"
      ? process.env.STRIPE_PRICE_ID_PRO_PLUS!
      : process.env.STRIPE_PRICE_ID_PRO!
  ).trim();
  const stripe = getStripe();

  // Existing subscribers switch price in place — a second checkout would double-bill.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeSubscriptionId: true },
  });
  if (user?.stripeSubscriptionId) {
    try {
      const current = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId
      );
      const isActive =
        current.status === "active" ||
        current.status === "trialing" ||
        current.status === "past_due";
      const item = current.items.data[0];
      if (isActive && item) {
        if (item.price.id === priceId) {
          return NextResponse.json({ error: "You're already on this plan." }, {
            status: 400,
          });
        }
        const updated = await stripe.subscriptions.update(current.id, {
          items: [{ id: item.id, price: priceId }],
          proration_behavior: "create_prorations",
        });
        await syncUserPlanFromSubscription(updated);
        return NextResponse.json({ updated: true });
      }
    } catch (err) {
      console.warn("[billing] subscription switch failed, falling back:", err);
    }
  }

  const customerId = await ensureStripeCustomer(session.user.id);
  const base = appBaseUrl();

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
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
