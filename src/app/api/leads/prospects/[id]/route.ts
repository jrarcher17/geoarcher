import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLeadGenAccess } from "@/lib/leads/api-guard";
import { serializeProspect } from "@/lib/leads/serialize";

async function loadOwnedProspect(userId: string, id: string) {
  return prisma.prospect.findFirst({
    where: { id, campaign: { userId } },
    include: {
      emails: { orderBy: { followUpIndex: "asc" } },
      campaign: { select: { id: true, name: true, mode: true, status: true } },
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  const prospect = await loadOwnedProspect(access.userId, id);
  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  return NextResponse.json({
    prospect: serializeProspect(prospect),
    campaign: prospect.campaign,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  const prospect = await loadOwnedProspect(access.userId, id);
  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === "disqualify") {
    const updated = await prisma.prospect.update({
      where: { id },
      data: { status: "DISQUALIFIED" },
      include: { emails: { orderBy: { followUpIndex: "asc" } } },
    });
    return NextResponse.json({ prospect: serializeProspect(updated) });
  }

  if (action === "markReplied") {
    const now = new Date();
    await prisma.outreachEmail.updateMany({
      where: { prospectId: id, status: { in: ["SENT", "DELIVERED", "OPENED"] } },
      data: { status: "REPLIED", repliedAt: now },
    });
    const updated = await prisma.prospect.update({
      where: { id },
      data: { status: "REPLIED" },
      include: { emails: { orderBy: { followUpIndex: "asc" } } },
    });
    return NextResponse.json({ prospect: serializeProspect(updated) });
  }

  const subject =
    typeof body?.subject === "string" ? body.subject.trim() : null;
  const emailBody = typeof body?.body === "string" ? body.body.trim() : null;
  if (subject || emailBody) {
    const draft = prospect.emails.find(
      (e) => e.followUpIndex === 0 && ["DRAFT", "QUEUED"].includes(e.status)
    );
    if (!draft) {
      return NextResponse.json(
        { error: "No editable draft outreach on this prospect." },
        { status: 400 }
      );
    }
    await prisma.outreachEmail.update({
      where: { id: draft.id },
      data: {
        ...(subject ? { subject } : {}),
        ...(emailBody ? { body: emailBody } : {}),
      },
    });
    const updated = await loadOwnedProspect(access.userId, id);
    return NextResponse.json({
      prospect: updated ? serializeProspect(updated) : null,
    });
  }

  return NextResponse.json(
    { error: "Provide action, or subject/body to edit the draft." },
    { status: 400 }
  );
}
