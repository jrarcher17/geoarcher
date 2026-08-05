import { NextResponse } from "next/server";
import { resolveProPriceLabel } from "@/lib/billing-price";
import { prisma } from "@/lib/db";
import {
  devBillingToggleAllowed,
  getPlans,
  planFromDb,
  stripeConfigured,
} from "@/lib/plans";
import {
  countUserScansThisMonth,
  countUserSites,
  getPlanForUser,
} from "@/lib/user-plan";
import { getServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      plan: true,
      createdAt: true,
      stripeSubscriptionId: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const proPrice = await resolveProPriceLabel();
  const basePlans = getPlans();
  const plans = {
    ...basePlans,
    pro: { ...basePlans.pro, priceLabel: proPrice },
  };
  const planId = planFromDb(user.plan);
  const limits = plans[planId];
  const sitesUsed = await countUserSites(session.user.id);
  const scansUsed = await countUserScansThisMonth(session.user.id);

  return NextResponse.json({
    user: {
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    billing: {
      plan: planId,
      planLabel: limits.label,
      priceLabel: limits.priceLabel,
      proPriceLabel: proPrice,
      limits,
      stripeEnabled: stripeConfigured(),
      devBillingToggle: devBillingToggleAllowed(),
      hasSubscription: Boolean(user.stripeSubscriptionId),
      usage: {
        sites: sitesUsed,
        sitesLimit: limits.sites,
        scansThisMonth: scansUsed,
        scansLimit: limits.scansPerMonth,
      },
    },
    plans,
  });
}
