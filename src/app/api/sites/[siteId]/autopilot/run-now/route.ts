import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { getTemporalClient, temporalConfigured } from "@/temporal/client";
import { autopilotWorkflowId } from "@/temporal/shared";

/** Wake the Autopilot loop immediately (also resumes if paused). */
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
  if (!temporalConfigured()) {
    return NextResponse.json(
      { error: "Temporal is not configured." },
      { status: 503 }
    );
  }

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(autopilotWorkflowId(siteId));
    await handle.signal("resume"); // clears pause and sets runNow
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[autopilot] run-now failed:", err);
    return NextResponse.json(
      { error: "Could not reach the Autopilot workflow." },
      { status: 502 }
    );
  }
}
