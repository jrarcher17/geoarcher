import { prisma } from "./db";
import { crawlSite } from "./crawler";
import { analyzeSite } from "./analysis";
import { getPlanForScanId } from "./user-plan";
import { getPlanLimits } from "./plans";
import type { PageExtraction } from "./types";
import type { Prisma } from "@/generated/prisma/client";

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

export async function runScan(scanId: string): Promise<void> {
  const scan = await prisma.scan.findUniqueOrThrow({
    where: { id: scanId },
    include: { site: true },
  });

  if (scan.status === "COMPLETE" || scan.status === "FAILED" || scan.status === "ANALYZING") {
    return;
  }
  if (scan.status === "CRAWLING" && scan.pagesCrawled > 0) {
    return;
  }

  const claimed = await prisma.scan.updateMany({
    where: {
      id: scanId,
      status: { in: ["QUEUED", "CRAWLING"] },
      pagesCrawled: 0,
    },
    data: { status: "CRAWLING" },
  });
  if (claimed.count === 0) {
    return;
  }

  try {
    const plan = await getPlanForScanId(scanId);
    const limits = getPlanLimits(plan);
    const maxPages = scan.benchmarkScanId
      ? limits.competitorMaxPages
      : limits.maxPagesPerScan;
    const pages: PageExtraction[] = await crawlSite(scan.site.url, {
      maxPages,
      onPage: async (page, count) => {
        await prisma.page.create({
          data: {
            scanId,
            url: page.url,
            title: page.title,
            metaDescription: page.metaDescription,
            canonicalUrl: page.canonicalUrl,
            statusCode: page.statusCode,
            wordCount: page.wordCount,
            loadTimeMs: page.loadTimeMs,
            extracted: asJson(page),
          },
        });
        await prisma.scan.update({
          where: { id: scanId },
          data: { pagesCrawled: count },
        });
      },
    });

    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "ANALYZING" },
    });

    const analysis = await analyzeSite(scan.site.url, pages);

    await prisma.analysis.create({
      data: {
        scanId,
        semanticMap: asJson(analysis.semanticMap),
        understanding: asJson(analysis.understanding),
        geoScore: asJson(analysis.geoScore),
        contentGaps: asJson(analysis.contentGaps),
        recommendations: asJson(analysis.recommendations),
      },
    });
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "COMPLETE", finishedAt: new Date() },
    });
  } catch (err) {
    console.error(`[scan ${scanId}] failed:`, err);
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
