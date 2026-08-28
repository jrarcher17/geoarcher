import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLeadGenAccess } from "@/lib/leads/api-guard";
import {
  importProspectAsSite,
  loadProspectAdvertising,
} from "@/lib/leads/import-site";

/**
 * Import a prospect's website as a Site, start a scan (and advertising
 * intelligence), then return the payload Ad Studio needs.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireLeadGenAccess();
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { id, campaign: { userId: access.userId } },
    select: { id: true, domain: true, analysis: true },
  });
  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  try {
    const imported = await importProspectAsSite(access.userId, prospect.domain);
    const advertising = await loadProspectAdvertising(access.userId, prospect);
    return NextResponse.json({
      ...imported,
      advertising,
      adStudioUrl: `/ad-studio?site=${imported.siteId}&prospect=${prospect.id}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not import this website.";
    const status = /plan includes|scans this month/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
