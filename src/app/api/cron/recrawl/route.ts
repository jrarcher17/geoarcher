import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { findSitesDueForRecrawl } from "@/lib/site-history";
import { latestAuditableScan } from "@/lib/seo/audit-runner";
import { dataForSeoConfigured } from "@/lib/seo/dataforseo";
import { lastRankCheckAt, runRankCheck } from "@/lib/seo/rank-tracker";
import { resumeLeadCampaigns } from "@/lib/leads/campaign-runner";
import { startScanPipeline, startSeoAuditJob } from "@/lib/jobs/start";

export const maxDuration = 300;

/**
 * Recrawl + SEO Autopilot upkeep hook — wire to QStash / Vercel Cron / Trigger.dev.
 * Authorization: Bearer CRON_SECRET (set in .env).
 *
 * Each run: starts due recrawls, re-audits Pro sites whose newest complete
 * scan has no SEO audit yet (scans started here get audited on the next run),
 * and refreshes keyword rankings older than RANK_CHECK_INTERVAL_HOURS.
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
  const dueAll = await findSitesDueForRecrawl(intervalDays);

  // Autopilot-enabled sites are managed by the Inngest Autopilot job — the cron
  // must not double-crawl or double-audit them.
  const autopilotSites = await prisma.site.findMany({
    where: { autopilotEnabled: true },
    select: { id: true },
  });
  const autopilotIds = new Set(autopilotSites.map((s) => s.id));
  const due = dueAll.filter((site) => !autopilotIds.has(site.siteId));
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
      withSeoAudit: false, // the upkeep loop below audits Pro sites
    });
  }

  // ---- SEO Autopilot upkeep (Pro sites only, not on Autopilot) ----
  const proSites = await prisma.site.findMany({
    where: {
      userSites: { some: { user: { plan: { in: ["PRO", "PRO_PLUS"] } } } },
      autopilotEnabled: false,
    },
    select: { id: true },
  });

  const rankIntervalMs =
    Number(process.env.RANK_CHECK_INTERVAL_HOURS ?? 24) * 60 * 60 * 1000;
  const seoAudits: string[] = [];
  const rankChecks: string[] = [];

  for (const site of proSites) {
    const scan = await latestAuditableScan(site.id);
    if (scan) {
      const existing = await prisma.seoAudit.findUnique({
        where: { scanId: scan.id },
        select: { id: true },
      });
      if (!existing) {
        seoAudits.push(site.id);
        await startSeoAuditJob({ siteId: site.id, scanId: scan.id });
      }
    }

    if (dataForSeoConfigured()) {
      const keywordCount = await prisma.seoKeyword.count({
        where: { siteId: site.id },
      });
      if (keywordCount > 0) {
        const last = await lastRankCheckAt(site.id);
        if (!last || Date.now() - last.getTime() > rankIntervalMs) {
          rankChecks.push(site.id);
          after(() =>
            runRankCheck(site.id).catch((err) =>
              console.error(`[cron] rank check failed for site ${site.id}:`, err)
            )
          );
        }
      }
    }
  }

  const leads = await resumeLeadCampaigns();

  return NextResponse.json({
    due: due.length,
    started: started.length,
    scanIds: started,
    seoAuditsStarted: seoAudits.length,
    rankChecksStarted: rankChecks.length,
    leadCampaignsResumed: leads.resumed.length,
  });
}
