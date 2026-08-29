import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { generateConceptImage } from "@/lib/advertising/concept-image";
import { userOwnsSite } from "@/lib/user-plan";

export const maxDuration = 120;

/** AI concept image for a Meta ad. Not a website photo and not a product shot. */
export async function POST(request: Request) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const offeringId = typeof body?.offeringId === "string" ? body.offeringId : null;
  if (!offeringId) {
    return NextResponse.json({ error: "offeringId is required." }, { status: 400 });
  }

  const offering = await prisma.offering.findUnique({
    where: { id: offeringId },
    select: { siteId: true },
  });
  if (!offering || !(await userOwnsSite(access.userId, offering.siteId))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  try {
    const image = await generateConceptImage({
      offeringId,
      angle: typeof body?.angle === "string" ? body.angle : undefined,
      headline: typeof body?.headline === "string" ? body.headline : undefined,
    });
    return NextResponse.json(image);
  } catch (err) {
    console.error("[ad-studio] concept image failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Concept image generation failed.",
      },
      { status: 502 }
    );
  }
}
