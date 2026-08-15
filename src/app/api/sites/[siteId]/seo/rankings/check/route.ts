import { NextResponse } from "next/server";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { dataForSeoConfigured } from "@/lib/seo/dataforseo";
import { lastRankCheckAt, runRankCheck } from "@/lib/seo/rank-tracker";

export const maxDuration = 300;

/** Minimum time between manual checks — each check costs DataForSEO credits. */
const MIN_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Run a rank check now for all tracked keywords. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  if (!dataForSeoConfigured()) {
    return NextResponse.json(
      {
        error:
          "DataForSEO is not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.",
      },
      { status: 503 }
    );
  }

  const last = await lastRankCheckAt(siteId);
  if (last && Date.now() - last.getTime() < MIN_CHECK_INTERVAL_MS) {
    const minutes = Math.ceil(
      (MIN_CHECK_INTERVAL_MS - (Date.now() - last.getTime())) / 60000
    );
    return NextResponse.json(
      { error: `Rankings were checked recently — try again in ${minutes} min.` },
      { status: 429 }
    );
  }

  try {
    const checked = await runRankCheck(siteId);
    return NextResponse.json({ checked });
  } catch (err) {
    console.error("[seo-rankings] check failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rank check failed." },
      { status: 502 }
    );
  }
}
