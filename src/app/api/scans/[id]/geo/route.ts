import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildGeoFixProposal,
  draftGapFaqs,
  blocksToJsonLd,
  type GeoJsonLdBlock,
} from "@/lib/geo-fix";
import type {
  ContentGap,
  PageExtraction,
  SemanticMap,
  Understanding,
} from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

async function loadScanContext(scanId: string) {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      site: { include: { geoConfig: true } },
      analysis: true,
      pages: true,
    },
  });
  if (!scan || scan.status !== "COMPLETE" || !scan.analysis) {
    return null;
  }
  const pages = scan.pages.map((p) => p.extracted as unknown as PageExtraction);
  const understanding = scan.analysis.understanding as unknown as Understanding;
  const semanticMap = scan.analysis.semanticMap as unknown as SemanticMap;
  const contentGaps = scan.analysis.contentGaps as unknown as ContentGap[];
  return { scan, pages, understanding, semanticMap, contentGaps };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await loadScanContext(id);
  if (!ctx) {
    return NextResponse.json(
      { error: "Complete scan with analysis required." },
      { status: 404 }
    );
  }

  const proposal = buildGeoFixProposal({
    siteUrl: ctx.scan.site.url,
    pages: ctx.pages,
    understanding: ctx.understanding,
    semanticMap: ctx.semanticMap,
    contentGaps: ctx.contentGaps,
  });

  const config = ctx.scan.site.geoConfig;
  const hits7d = await prisma.geoHit.count({
    where: {
      siteId: ctx.scan.siteId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return NextResponse.json({
    siteKey: ctx.scan.site.geoKey,
    siteUrl: ctx.scan.site.url,
    proposal,
    published: config
      ? {
          enabled: config.enabled,
          updatedAt: config.updatedAt.toISOString(),
          blockCount: ((config.jsonLd as unknown[]) ?? []).length,
          sourceScanId: config.sourceScanId,
        }
      : null,
    telemetry: { hitsLast7Days: hits7d },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await loadScanContext(id);
  if (!ctx) {
    return NextResponse.json(
      { error: "Complete scan with analysis required." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "draft-gap-faqs" ? "draft-gap-faqs" : null;
  if (!action) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const gapFaqs = await draftGapFaqs(
    ctx.scan.site.url,
    ctx.understanding,
    ctx.contentGaps.slice(0, 10)
  );
  const proposal = buildGeoFixProposal({
    siteUrl: ctx.scan.site.url,
    pages: ctx.pages,
    understanding: ctx.understanding,
    semanticMap: ctx.semanticMap,
    contentGaps: ctx.contentGaps,
    gapFaqs,
  });

  return NextResponse.json({ proposal });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await loadScanContext(id);
  if (!ctx) {
    return NextResponse.json(
      { error: "Complete scan with analysis required." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "Body must include enabled (boolean) and blocks (array)." },
      { status: 400 }
    );
  }

  const blocks = Array.isArray(body.blocks)
    ? (body.blocks as GeoJsonLdBlock[])
    : null;
  if (!blocks) {
    return NextResponse.json({ error: "blocks array required." }, { status: 400 });
  }

  const jsonLd = blocksToJsonLd(blocks);
  const meta = (body.meta as Record<string, string>) ?? {};

  await prisma.geoConfig.upsert({
    where: { siteId: ctx.scan.siteId },
    update: {
      enabled: body.enabled,
      jsonLd: jsonLd as Prisma.InputJsonValue,
      meta: meta as Prisma.InputJsonValue,
      sourceScanId: id,
    },
    create: {
      siteId: ctx.scan.siteId,
      enabled: body.enabled,
      jsonLd: jsonLd as Prisma.InputJsonValue,
      meta: meta as Prisma.InputJsonValue,
      sourceScanId: id,
    },
  });

  return NextResponse.json({ ok: true, enabled: body.enabled, blockCount: jsonLd.length });
}
