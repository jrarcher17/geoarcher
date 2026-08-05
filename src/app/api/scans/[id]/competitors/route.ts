import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildCompetitorComparison,
  rowFromScan,
} from "@/lib/competitor-compare";
import { runScan } from "@/lib/scan-runner";
import { getServerSession } from "@/lib/session";
import { assertCanStartScan, userOwnsScan } from "@/lib/user-plan";

export const maxDuration = 300;

const MAX_COMPETITORS = 5;

function normalizeSiteUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function loadBenchmark(scanId: string) {
  return prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      site: true,
      analysis: true,
      visibility: true,
      competitorScans: {
        include: {
          site: true,
          analysis: true,
          visibility: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = await loadBenchmark(id);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }
  if (scan.benchmarkScanId) {
    return NextResponse.json(
      { error: "Open the primary scan to view competitor comparison." },
      { status: 400 }
    );
  }

  const primary = rowFromScan({
    id: scan.id,
    status: scan.status,
    pagesCrawled: scan.pagesCrawled,
    siteUrl: scan.site.url,
    analysis: scan.analysis,
    visibilityResults:
      scan.visibility?.status === "COMPLETE" ? scan.visibility.results : null,
  });

  const competitors = scan.competitorScans.map((c) =>
    rowFromScan({
      id: c.id,
      status: c.status,
      pagesCrawled: c.pagesCrawled,
      siteUrl: c.site.url,
      analysis: c.analysis,
      visibilityResults:
        c.visibility?.status === "COMPLETE" ? c.visibility.results : null,
    })
  );

  return NextResponse.json(buildCompetitorComparison(primary, competitors));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  if (!(await userOwnsScan(session.user.id, id))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const benchmark = await prisma.scan.findUnique({
    where: { id },
    include: { site: true, competitorScans: true },
  });
  if (!benchmark) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }
  if (benchmark.benchmarkScanId) {
    return NextResponse.json(
      { error: "Competitors can only be added to a primary scan." },
      { status: 400 }
    );
  }
  if (benchmark.status !== "COMPLETE") {
    return NextResponse.json(
      { error: "Complete your scan before adding competitors." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const rawUrls: unknown[] = Array.isArray(body?.urls) ? body.urls : [];
  const normalized = rawUrls
    .filter((u): u is string => typeof u === "string")
    .map((u) => normalizeSiteUrl(u))
    .filter((u): u is string => u !== null);
  const urls: string[] = [...new Set(normalized)];

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one valid competitor URL." },
      { status: 400 }
    );
  }

  const existingUrls = new Set<string>();
  const competitorSites = await prisma.scan.findMany({
    where: { benchmarkScanId: id },
    include: { site: true },
  });
  for (const c of competitorSites) {
    existingUrls.add(c.site.url);
  }

  const slotLeft = MAX_COMPETITORS - competitorSites.length;
  if (slotLeft <= 0) {
    return NextResponse.json(
      { error: `Maximum ${MAX_COMPETITORS} competitors per scan.` },
      { status: 400 }
    );
  }

  const started: string[] = [];
  const skipped: string[] = [];

  const toStart = urls.filter(
    (siteUrl) =>
      siteUrl !== benchmark.site.url && !existingUrls.has(siteUrl)
  ).slice(0, slotLeft);

  if (toStart.length > 0) {
    const scanLimitError = await assertCanStartScan(
      session.user.id,
      toStart.length
    );
    if (scanLimitError) {
      return NextResponse.json({ error: scanLimitError }, { status: 403 });
    }
  }

  for (const siteUrl of urls) {
    if (started.length >= slotLeft) break;
    if (siteUrl === benchmark.site.url) {
      skipped.push(siteUrl);
      continue;
    }
    if (existingUrls.has(siteUrl)) {
      skipped.push(siteUrl);
      continue;
    }

    const site = await prisma.site.upsert({
      where: { url: siteUrl },
      update: {},
      create: { url: siteUrl },
    });

    const scan = await prisma.scan.create({
      data: { siteId: site.id, benchmarkScanId: id },
    });
    existingUrls.add(siteUrl);
    started.push(scan.id);
    after(() => runScan(scan.id));
  }

  if (started.length === 0) {
    return NextResponse.json(
      {
        error:
          skipped.length > 0
            ? "All URLs were skipped (duplicate, your own site, or limit reached)."
            : "No competitors started.",
        skipped,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ started, skipped }, { status: 201 });
}
