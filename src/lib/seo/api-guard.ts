import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { getPlanForUser, userOwnsSite } from "@/lib/user-plan";

export interface SeoAccess {
  userId: string;
}

/** Session + site ownership + Pro plan gate shared by all SEO Autopilot routes. */
export async function requireSeoAccess(
  siteId: string
): Promise<SeoAccess | NextResponse> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = session.user.id;
  if (!(await userOwnsSite(userId, siteId))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const plan = await getPlanForUser(userId);
  if (plan === "free") {
    return NextResponse.json(
      {
        error: "SEO Autopilot is available on the Pro plan.",
        upgradeRequired: true,
      },
      { status: 403 }
    );
  }
  return { userId };
}
