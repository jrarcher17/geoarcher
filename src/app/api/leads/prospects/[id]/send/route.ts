import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLeadGenAccess } from "@/lib/leads/api-guard";
import { serializeProspect } from "@/lib/leads/serialize";
import { sendOutreach } from "@/temporal/lead-activities";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { id, campaign: { userId: access.userId } },
    select: { id: true },
  });
  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  try {
    const outcome = await sendOutreach(id);
    if (outcome === "capped") {
      return NextResponse.json(
        { error: "Daily send cap reached. The email is queued for tomorrow." },
        { status: 429 }
      );
    }
    if (outcome === "skipped") {
      return NextResponse.json(
        { error: "This prospect is not ready to send." },
        { status: 400 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Could not send outreach.",
      },
      { status: 502 }
    );
  }

  const updated = await prisma.prospect.findUnique({
    where: { id },
    include: { emails: { orderBy: { followUpIndex: "asc" } } },
  });
  return NextResponse.json({
    prospect: updated ? serializeProspect(updated) : null,
  });
}
