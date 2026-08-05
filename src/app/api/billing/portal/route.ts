import { NextResponse } from "next/server";
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

  const user = await ensureStripeCustomer(session.user.id);
  const stripe = getStripe();
  const base = appBaseUrl();

  const portal = await stripe.billingPortal.sessions.create({
    customer: user,
    return_url: `${base}/settings?tab=billing`,
  });

  return NextResponse.json({ url: portal.url });
}
