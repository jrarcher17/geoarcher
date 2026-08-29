import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { isCreativePlatform } from "@/lib/advertising/creative-formats";
import { generateConceptCards } from "@/lib/advertising/creative-studio";
import { userOwnsSite } from "@/lib/user-plan";

export const maxDuration = 120;

/** Ten original concept cards — copy only. */
export async function POST(request: Request) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const offeringId = typeof body?.offeringId === "string" ? body.offeringId : null;
  const platform = isCreativePlatform(body?.platform) ? body.platform : null;
  if (!offeringId || !platform) {
    return NextResponse.json(
      { error: "offeringId and platform are required." },
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

  try {
    const result = await generateConceptCards({ offeringId, platform });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[creative-studio] concepts failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Concept generation failed." },
      { status: 502 }
    );
  }
}
