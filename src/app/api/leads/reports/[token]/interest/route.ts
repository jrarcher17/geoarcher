import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ProspectReport, ReportInterest } from "@/lib/leads/ai";
import { sendInternalEmail } from "@/lib/leads/email";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const prospect = await prisma.prospect.findUnique({
    where: { reportToken: token },
    include: {
      campaign: { include: { user: { select: { name: true, email: true } } } },
    },
  });
  if (!prospect?.report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const report = prospect.report as unknown as ProspectReport;
  if (report.interest?.email) {
    return NextResponse.json({ ok: true, alreadyRequested: true });
  }

  const interest: ReportInterest = {
    email,
    at: new Date().toISOString(),
    ...(name ? { name } : {}),
  };

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      report: { ...report, interest } as object,
      status:
        prospect.status === "CONTACTED" || prospect.status === "QUALIFIED"
          ? "REPLIED"
          : prospect.status,
    },
  });

  try {
    await sendInternalEmail({
      to: prospect.campaign.user.email,
      replyTo: email,
      subject: `${prospect.companyName} requested the GEO fix plan`,
      body: [
        `${name || "Someone"} (${email}) asked to be contacted from the public report for ${prospect.companyName} (${prospect.domain}).`,
        "",
        "They want the issues fixed and tracked — follow up with the Pro Plus plan and the 3 highest-impact fixes.",
        "",
        `Report: /r/${prospect.reportToken}`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("[leads] interest notify failed:", err);
  }

  return NextResponse.json({ ok: true });
}
