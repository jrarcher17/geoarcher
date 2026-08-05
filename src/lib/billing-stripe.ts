import type Stripe from "stripe";
import { prisma } from "./db";
import { getStripe } from "./stripe";

export async function syncUserPlanFromSubscription(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const active =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due";

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: active ? "PRO" : "FREE",
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
        plan: active ? "PRO" : "FREE",
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
        plan: active ? "PRO" : "FREE",
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
