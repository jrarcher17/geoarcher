import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { devBillingToggleAllowed, planFromDb } from "@/lib/plans";
import { getServerSession } from "@/lib/session";

/** Dev-only plan toggle. Production upgrades go through Stripe Checkout. */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!devBillingToggleAllowed()) {
    return NextResponse.json(
      { error: "Use billing checkout to change plans." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const plan =
    body?.plan === "free"
      ? ("FREE" as const)
      : body?.plan === "pro"
        ? ("PRO" as const)
        : body?.plan === "proPlus"
          ? ("PRO_PLUS" as const)
          : null;
  if (!plan) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { plan },
  });

  return NextResponse.json({ ok: true, plan: planFromDb(plan) });
}
