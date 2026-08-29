import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findSitesDueForRecrawl } from "@/lib/site-history";
import { resumeLeadCampaigns } from "@/lib/leads/campaign-runner";
import { startScanPipeline } from "@/lib/jobs/start";

export const maxDuration = 300;

/**
 * Recrawl + lead-campaign resume hook — wire to QStash / Vercel Cron.
 * Authorization: Bearer CRON_SECRET (set in .env).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const intervalDays = Number(process.env.RECRAWL_INTERVAL_DAYS ?? 7);
  const due = await findSitesDueForRecrawl(intervalDays);
  const started: string[] = [];

  for (const site of due) {
    const active = await prisma.scan.findFirst({
      where: {
        siteId: site.siteId,
        status: { in: ["QUEUED", "CRAWLING", "ANALYZING"] },
      },
    });
    if (active) continue;

    const scan = await prisma.scan.create({ data: { siteId: site.siteId } });
    started.push(scan.id);
    await startScanPipeline({
      scanId: scan.id,
      siteId: site.siteId,
    });
  }

  const leads = await resumeLeadCampaigns();

  return NextResponse.json({
    due: due.length,
    started: started.length,
    scanIds: started,
    leadCampaignsResumed: leads.resumed.length,
  });
}
