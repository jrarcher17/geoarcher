import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { getPlanForUser, userOwnsSite } from "@/lib/user-plan";

export interface AdAccess {
  userId: string;
}

/** Session + site ownership. Any plan can view its site's intelligence. */
export async function requireSiteAccess(
  siteId: string
): Promise<AdAccess | NextResponse> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = session.user.id;
  if (!(await userOwnsSite(userId, siteId))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  return { userId };
}

/** Session + Pro plan gate shared by Ad Studio / Campaigns / Analytics routes. */
export async function requireAdAccess(): Promise<AdAccess | NextResponse> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = session.user.id;
  const plan = await getPlanForUser(userId);
  if (plan === "free") {
    return NextResponse.json(
      {
        error: "Ad Studio is available on the Pro plan.",
        upgradeRequired: true,
      },
      { status: 403 }
    );
  }
  return { userId };
}
