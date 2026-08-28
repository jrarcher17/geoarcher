import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLeadGenAccess } from "@/lib/leads/api-guard";
import type { ProspectAnalysis, ProspectProblem } from "@/lib/leads/analyze";
import { loadProspectAdvertising } from "@/lib/leads/import-site";
import { buildOutreachDraft, greetingName } from "@/lib/leads/outreach-copy";
import { serializeProspect } from "@/lib/leads/serialize";
import { appBaseUrl } from "@/lib/stripe";
import { prepareOutreach } from "@/lib/leads/pipeline";

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
    advertising: await loadProspectAdvertising(access.userId, prospect),
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

  const contactEmail =
    typeof body?.contactEmail === "string" ? body.contactEmail.trim() : null;
  if (contactEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    await prisma.prospect.update({
      where: { id },
      data: {
        contactEmail: contactEmail.toLowerCase(),
        contactName:
          typeof body?.contactName === "string" && body.contactName.trim()
            ? body.contactName.trim()
            : prospect.contactName,
        status:
          prospect.status === "CLOSED" || prospect.status === "FAILED"
            ? "QUALIFIED"
            : prospect.status,
        error: null,
      },
    });
    await prepareOutreach(id).catch((err) =>
      console.error("[leads] prepare after contact save failed:", err)
    );
    const hasDraft = await prisma.outreachEmail.findFirst({
      where: { prospectId: id, followUpIndex: 0 },
    });
    const savedName =
      typeof body?.contactName === "string" && body.contactName.trim()
        ? body.contactName.trim()
        : prospect.contactName;
    if (!hasDraft) {
      const sender = await prisma.user.findUnique({
        where: { id: access.userId },
        select: { name: true },
      });
      const analysis = prospect.analysis as ProspectAnalysis | null;
      const draft = buildOutreachDraft({
        companyName: prospect.companyName,
        domain: prospect.domain,
        siteUrl: analysis?.siteUrl,
        senderName: sender?.name ?? "John",
        contactName: savedName,
        pagesCrawled: analysis?.pagesCrawled,
        problems: (prospect.problems ?? []) as unknown as ProspectProblem[],
        reportUrl: `${appBaseUrl()}/r/${prospect.reportToken}`,
      });
      await prisma.outreachEmail.create({
        data: {
          prospectId: id,
          subject: draft.subject,
          body: draft.body,
          status: "DRAFT",
          followUpIndex: 0,
        },
      });
    } else if (
      ["DRAFT", "QUEUED"].includes(hasDraft.status) &&
      /^Hi there,/i.test(hasDraft.body)
    ) {
      const first = greetingName(savedName);
      if (first !== "there") {
        await prisma.outreachEmail.update({
          where: { id: hasDraft.id },
          data: { body: hasDraft.body.replace(/^Hi there,/i, `Hi ${first},`) },
        });
      }
    }
    const updated = await loadOwnedProspect(access.userId, id);
    return NextResponse.json({
      prospect: updated ? serializeProspect(updated) : null,
    });
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
