import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import {
  AD_TONES,
  generateMetaAssets,
  type AdTone,
  type CampaignBrief,
} from "@/lib/advertising/generate";
import { userOwnsSite } from "@/lib/user-plan";

export const maxDuration = 120;

const GOALS = ["LEADS", "SALES", "TRAFFIC", "PHONE_CALLS", "AWARENESS"] as const;

/** Meta-only regeneration for Change Angle and New Version. */
export async function POST(request: Request) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const offeringId = typeof body?.offeringId === "string" ? body.offeringId : null;
  const goal = GOALS.includes(body?.goal) ? (body.goal as CampaignBrief["goal"]) : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const landingPage =
    typeof body?.landingPage === "string" ? body.landingPage.trim() : "";
  if (!offeringId || !goal || !name || !landingPage) {
    return NextResponse.json(
      { error: "offeringId, name, goal and landingPage are required." },
      { status: 400 }
    );
  }

  const offering = await prisma.offering.findUnique({
    where: { id: offeringId },
    select: { siteId: true },
  });
  if (!offering || !(await userOwnsSite(access.userId, offering.siteId))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const tone: AdTone = (AD_TONES as readonly string[]).includes(body?.tone)
    ? (body.tone as AdTone)
    : "Professional";

  try {
    const result = await generateMetaAssets(offeringId, {
      name,
      goal,
      objectiveNote:
        typeof body?.objectiveNote === "string" ? body.objectiveNote.trim() : "",
      landingPage,
      budgetDailyCents:
        typeof body?.budgetDailyCents === "number" ? body.budgetDailyCents : null,
      location: typeof body?.location === "string" ? body.location.trim() : "",
      audience: typeof body?.audience === "string" ? body.audience.trim() : "",
      tone,
      offer: typeof body?.offer === "string" ? body.offer.trim() : "",
      angle: typeof body?.angle === "string" ? body.angle.trim() : "",
      opportunityId:
        typeof body?.opportunityId === "string" ? body.opportunityId : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ad-studio] meta generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Meta generation failed." },
      { status: 502 }
    );
  }
}
