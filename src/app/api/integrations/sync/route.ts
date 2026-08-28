import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { syncUserCampaignMetrics } from "@/lib/advertising/sync";

export const maxDuration = 120;

/** Pull live spend/conversion rows from connected ad accounts. */
export async function POST() {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  try {
    const upserts = await syncUserCampaignMetrics(access.userId, 30);
    return NextResponse.json({ ok: true, upserts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 502 }
    );
  }
}
