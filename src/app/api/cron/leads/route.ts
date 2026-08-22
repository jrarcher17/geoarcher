import { NextResponse } from "next/server";
import { resumeLeadCampaigns } from "@/lib/leads/campaign-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Continue Lead Machine campaigns on the server.
 * Authorization: Bearer CRON_SECRET
 *
 * Hit every 5–15 minutes (or after each campaign slice self-chains here)
 * so a 25-prospect overnight job keeps running after the browser closes.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    campaignId?: string;
  } | null;

  const result = await resumeLeadCampaigns({
    campaignId:
      typeof body?.campaignId === "string" ? body.campaignId : undefined,
  });

  return NextResponse.json(result);
}
