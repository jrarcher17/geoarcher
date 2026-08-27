import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inngestConfigured } from "@/inngest/client";
import { startAutopilot } from "@/lib/jobs/start";
import { requireSeoAccess } from "@/lib/seo/api-guard";

/** Queue an Autopilot cycle immediately. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { autopilotEnabled: true },
  });
  if (!site?.autopilotEnabled) {
    return NextResponse.json(
      { error: "Turn Autopilot on first." },
      { status: 409 }
    );
  }
  if (!inngestConfigured()) {
    return NextResponse.json(
      { error: "Inngest is not configured." },
      { status: 503 }
    );
  }

  try {
    await startAutopilot(siteId, { force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[autopilot] run-now failed:", err);
    return NextResponse.json(
      { error: "Could not queue the Autopilot job." },
      { status: 502 }
    );
  }
}
