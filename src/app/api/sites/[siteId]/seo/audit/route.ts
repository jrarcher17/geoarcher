import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { latestAuditableScan } from "@/lib/seo/audit-runner";
import { startSeoAuditJob } from "@/lib/temporal-start";

export const maxDuration = 300;

const RUNNING_GRACE_MS = 10 * 60 * 1000;

/** Run (or re-run) the SEO audit against the site's latest complete scan. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const scan = await latestAuditableScan(siteId);
  if (!scan) {
    return NextResponse.json(
      { error: "No completed scan with pages found. Run a site scan first." },
      { status: 409 }
    );
  }

  // Don't double-run while a recent audit is still in progress.
  const running = await prisma.seoAudit.findFirst({
    where: {
      siteId,
      status: "RUNNING",
      createdAt: { gte: new Date(Date.now() - RUNNING_GRACE_MS) },
    },
  });
  if (running) {
    return NextResponse.json({ started: false, auditId: running.id, scanId: scan.id });
  }

  await startSeoAuditJob({ siteId, scanId: scan.id });

  return NextResponse.json({ started: true, scanId: scan.id }, { status: 202 });
}
