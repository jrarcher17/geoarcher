import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { generateConceptImage } from "@/lib/advertising/concept-image";
import {
  FORMAT_SPECS,
  isCreativeFormat,
  isCreativePlatform,
} from "@/lib/advertising/creative-formats";
import { generateLayoutCopy } from "@/lib/advertising/creative-studio";
import { userOwnsSite } from "@/lib/user-plan";

export const maxDuration = 120;

/** One layout: copy plus optional AI concept image. */
export async function POST(request: Request) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const offeringId = typeof body?.offeringId === "string" ? body.offeringId : null;
  const angle = typeof body?.angle === "string" ? body.angle.trim() : "";
  const platform = isCreativePlatform(body?.platform) ? body.platform : null;
  const format = isCreativeFormat(body?.format) ? body.format : null;
  if (!offeringId || !angle || !platform || !format) {
    return NextResponse.json(
      { error: "offeringId, angle, platform and format are required." },
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
    const result = await generateLayoutCopy({
      offeringId,
      platform,
      angle,
      format,
    });
    let image: { url: string; alt: string } | null = null;
    if (body?.generateImage === true) {
      image = await generateConceptImage({
        offeringId,
        angle,
        headline: result.copy.headline,
        size: FORMAT_SPECS[format].imageSize,
      });
    }
    return NextResponse.json({ ...result, image });
  } catch (err) {
    console.error("[creative-studio] generate failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Creative generation failed." },
      { status: 502 }
    );
  }
}
