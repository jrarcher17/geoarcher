import type Stripe from "stripe";
import type { PlanTier } from "@/generated/prisma/enums";
import { prisma } from "./db";
import { getStripe } from "./stripe";

/** Resolve the plan tier a Stripe subscription grants. */
function tierFromSubscription(subscription: Stripe.Subscription): PlanTier {
  const active =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due";
  if (!active) return "FREE";

  const proPlusPriceId = process.env["STRIPE_PRICE_ID_PRO_PLUS"]?.trim();
  const isProPlus =
    Boolean(proPlusPriceId) &&
    subscription.items.data.some((item) => item.price.id === proPlusPriceId);
  return isProPlus ? "PRO_PLUS" : "PRO";
}

export async function syncUserPlanFromSubscription(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const plan = tierFromSubscription(subscription);

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
      },
    });
    return;
  }

  const bySub = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true },
  });
  if (bySub) {
    await prisma.user.update({
      where: { id: bySub.id },
      data: {
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
      },
    });
    return;
  }

  const byCustomer = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (byCustomer) {
    await prisma.user.update({
      where: { id: byCustomer.id },
      data: {
        plan,
        stripeSubscriptionId: subscription.id,
      },
    });
  }
}

export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      stripeCustomerId: true,
    },
  });

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
