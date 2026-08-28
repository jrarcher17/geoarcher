import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";

/** Compact live-status strip for the app chrome. */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const links = await prisma.userSite.findMany({
    where: { userId: session.user.id },
    select: {
      site: {
        select: {
          autopilotEnabled: true,
          seoOpportunities: { select: { status: true } },
          scans: {
            where: { benchmarkScanId: null, status: "COMPLETE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              pagesCrawled: true,
              analysis: { select: { contentGaps: true } },
              competitorScans: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  let pages = 0;
  let opportunities = 0;
  let automated = 0;
  let competitors = 0;
  let questions = 0;
  let optimizing = false;

  for (const link of links) {
    if (link.site.autopilotEnabled) optimizing = true;
    const scan = link.site.scans[0];
    pages += scan?.pagesCrawled ?? 0;
    competitors += scan?.competitorScans.length ?? 0;
    const gaps = scan?.analysis?.contentGaps;
    if (Array.isArray(gaps)) questions += gaps.length;
    for (const opp of link.site.seoOpportunities) {
      if (opp.status === "DISMISSED") continue;
      opportunities += 1;
      if (opp.status === "COMPLETED") automated += 1;
    }
  }

  return NextResponse.json({
    active: optimizing || pages > 0,
    optimizing,
    pages,
    opportunities,
    automated,
    competitors,
    questions,
    sites: links.length,
  });
}
