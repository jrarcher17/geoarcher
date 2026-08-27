import { NextResponse } from "next/server";
import { apolloConfigured } from "@/lib/leads/apollo";
import { getQuotaState } from "@/lib/leads/api-guard";
import { resendConfigured } from "@/lib/leads/email";
import { getServerSession } from "@/lib/session";
import { getPlanForUser } from "@/lib/user-plan";
import { inngestConfigured } from "@/inngest/client";

export const dynamic = "force-dynamic";

/** Lightweight gate + quota for the Lead Machine UI (no 403 on free/pro). */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const plan = await getPlanForUser(session.user.id);
  const allowed = plan === "proPlus";
  const quota = allowed ? await getQuotaState(session.user.id) : null;

  return NextResponse.json({
    plan,
    allowed,
    quota,
    configured: {
      inngest: inngestConfigured(),
      apollo: apolloConfigured(),
      resend: resendConfigured(),
    },
  });
}
