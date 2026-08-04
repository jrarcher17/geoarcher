import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  compareToPreviousScan,
  getSiteHistoryForScan,
} from "@/lib/site-history";
import type { ScanResult } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: {
      site: true,
      analysis: true,
      simulation: true,
      visibility: true,
      pages: {
        select: { url: true, title: true, wordCount: true, statusCode: true },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const [historyData, comparison] = await Promise.all([
    getSiteHistoryForScan(id),
    scan.status === "COMPLETE" ? compareToPreviousScan(id) : Promise.resolve(null),
  ]);

  const result: ScanResult = {
    id: scan.id,
    status: scan.status,
    error: scan.error,
    siteUrl: scan.site.url,
    benchmarkScanId: scan.benchmarkScanId,
    pagesCrawled: scan.pagesCrawled,
    createdAt: scan.createdAt.toISOString(),
    finishedAt: scan.finishedAt?.toISOString() ?? null,
    pages: scan.pages,
    analysis: scan.analysis
      ? {
          semanticMap: scan.analysis.semanticMap as never,
          understanding: scan.analysis.understanding as never,
          geoScore: scan.analysis.geoScore as never,
          contentGaps: scan.analysis.contentGaps as never,
          recommendations: scan.analysis.recommendations as never,
        }
      : null,
    simulation: scan.simulation
      ? {
          status: scan.simulation.status,
          error: scan.simulation.error,
          results: (scan.simulation.results as never) ?? null,
        }
      : null,
    visibility: scan.visibility
      ? {
          status: scan.visibility.status,
          error: scan.visibility.error,
          results: (scan.visibility.results as never) ?? null,
        }
      : null,
    history: historyData?.entries ?? null,
    comparison,
  };
  return NextResponse.json(result);
}
