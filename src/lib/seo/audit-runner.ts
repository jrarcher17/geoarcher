import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type {
  ContentGap,
  PageExtraction,
  SemanticMap,
  Understanding,
} from "@/lib/types";
import { computeSeoAudit } from "./checks";
import {
  buildDeterministicOpportunities,
  generateAiOpportunities,
  summarizeAuditForAi,
} from "./opportunities";
import {
  generateContentPlan,
  generateLinkSuggestions,
  generateSearchOpportunities,
  type SiteContext,
} from "./phase2-ai";
import type { SeoOpportunityDraft } from "./types";

/** Latest COMPLETE primary scan (with pages) usable as the audit source. */
export async function latestAuditableScan(siteId: string) {
  return prisma.scan.findFirst({
    where: {
      siteId,
      benchmarkScanId: null,
      status: "COMPLETE",
      pagesCrawled: { gt: 0 },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, pagesCrawled: true, createdAt: true },
  });
}

/** Upsert opportunities by (siteId, title) so user statuses survive re-audits. */
async function mergeOpportunities(
  siteId: string,
  auditId: string,
  drafts: SeoOpportunityDraft[]
): Promise<void> {
  const existing = await prisma.seoOpportunity.findMany({
    where: { siteId },
    select: { id: true, title: true },
  });
  const byTitle = new Map(existing.map((o) => [o.title.toLowerCase(), o.id]));

  for (const draft of drafts) {
    const data = {
      category: draft.category,
      title: draft.title,
      description: draft.description,
      observed: draft.observed,
      inferred: draft.inferred,
      impact: draft.impact,
      difficulty: draft.difficulty,
      opportunityScore: draft.opportunityScore,
      contentType: draft.contentType,
      affectedPages: draft.affectedPages,
      source: draft.source,
      auditId,
    };
    const existingId = byTitle.get(draft.title.toLowerCase());
    if (existingId) {
      // Refresh evidence and score but keep the user's workflow status.
      await prisma.seoOpportunity.update({ where: { id: existingId }, data });
    } else {
      await prisma.seoOpportunity.create({ data: { ...data, siteId } });
    }
  }
}

/**
 * Run the SEO audit for a site against an existing COMPLETE scan.
 * Stage 1 (deterministic) persists immediately; the AI stages (opportunities,
 * content plan, internal links, search topics) run in parallel afterwards.
 * Reuses stored crawl pages — no crawling here.
 *
 * `withAi: false` runs the deterministic stage only (used for competitor
 * scans, which get scored but never receive opportunities or plans).
 */
export async function runSeoAudit(
  siteId: string,
  scanId: string,
  { withAi = true }: { withAi?: boolean } = {}
): Promise<string> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      pages: { select: { id: true, extracted: true } },
      analysis: true,
    },
  });
  if (!scan || scan.siteId !== siteId) throw new Error("Scan not found for site.");
  if (scan.status !== "COMPLETE" || scan.pages.length === 0) {
    throw new Error("Scan has no crawled pages to audit.");
  }

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found.");

  const pages = scan.pages.map((p) => ({
    pageId: p.id,
    extracted: p.extracted as unknown as PageExtraction,
  }));

  const understanding = scan.analysis
    ? (scan.analysis.understanding as unknown as Understanding)
    : null;
  const semanticMap = scan.analysis
    ? (scan.analysis.semanticMap as unknown as SemanticMap)
    : null;
  const contentGaps = scan.analysis
    ? ((scan.analysis.contentGaps as unknown as ContentGap[]) ?? [])
    : [];

  // ---- Stage 1: deterministic checks + scores ----
  const computation = computeSeoAudit(site.url, pages, contentGaps.length);

  // One row per scan (`scanId` is unique). Never delete+recreate mid-run —
  // Autopilot, a manual re-audit, or an Inngest retry would otherwise change
  // the id and make later `update({ id })` throw "record not found".
  const audit = await prisma.seoAudit.upsert({
    where: { scanId },
    create: {
      siteId,
      scanId,
      status: "RUNNING",
      overallScore: computation.overallScore,
      categoryScores: JSON.parse(
        JSON.stringify({ categories: computation.categories, totals: computation.totals })
      ),
      siteChecks: JSON.parse(JSON.stringify(computation.siteChecks)),
    },
    update: {
      status: "RUNNING",
      error: null,
      finishedAt: null,
      contentPlan: Prisma.DbNull,
      overallScore: computation.overallScore,
      categoryScores: JSON.parse(
        JSON.stringify({ categories: computation.categories, totals: computation.totals })
      ),
      siteChecks: JSON.parse(JSON.stringify(computation.siteChecks)),
    },
  });

  await prisma.seoPageAudit.deleteMany({ where: { auditId: audit.id } });
  await prisma.seoPageAudit.createMany({
    data: computation.pages.map((p) => ({
      auditId: audit.id,
      pageId: p.pageId,
      url: p.url,
      score: p.score,
      issues: JSON.parse(JSON.stringify(p.issues)),
      facts: JSON.parse(JSON.stringify(p.facts)),
    })),
  });

  if (!withAi) {
    await persistAudit(audit.id, { status: "COMPLETE", finishedAt: new Date() });
    return audit.id;
  }

  const deterministicDrafts = buildDeterministicOpportunities(computation);
  await mergeOpportunities(siteId, audit.id, deterministicDrafts);

  // ---- AI stages (parallel): opportunities, content plan, links, search ----
  const ctx: SiteContext = {
    siteUrl: site.url,
    understanding,
    semanticMap,
    contentGaps,
  };

  const [oppsResult, contentResult, linksResult, searchResult] =
    await Promise.allSettled([
      generateAiOpportunities({
        ...ctx,
        pageInventory: pages.map((p) => ({
          url: p.extracted.url,
          title: p.extracted.title,
          wordCount: p.extracted.wordCount,
        })),
        auditSummary: summarizeAuditForAi(computation),
      }),
      generateContentPlan(ctx, computation),
      generateLinkSuggestions(ctx, computation),
      generateSearchOpportunities(ctx, computation),
    ]);

  const failures: string[] = [];

  if (oppsResult.status === "fulfilled") {
    await mergeOpportunities(siteId, audit.id, oppsResult.value);
  } else {
    console.error("[seo-audit] opportunity stage failed:", oppsResult.reason);
    failures.push("opportunities");
  }

  if (contentResult.status === "fulfilled") {
    await persistAudit(audit.id, {
      contentPlan: JSON.parse(JSON.stringify(contentResult.value)),
    });
  } else {
    console.error("[seo-audit] content plan stage failed:", contentResult.reason);
    failures.push("content plan");
  }

  if (linksResult.status === "fulfilled") {
    for (const s of linksResult.value) {
      // Keep the user's status on re-audits; refresh evidence.
      await prisma.seoLinkSuggestion.upsert({
        where: {
          siteId_fromUrl_toUrl: { siteId, fromUrl: s.fromUrl, toUrl: s.toUrl },
        },
        update: {
          anchor: s.anchor,
          relevance: s.relevance,
          reason: s.reason,
          auditId: audit.id,
        },
        create: { ...s, siteId, auditId: audit.id },
      });
    }
  } else {
    console.error("[seo-audit] link suggestion stage failed:", linksResult.reason);
    failures.push("internal links");
  }

  if (searchResult.status === "fulfilled") {
    for (const o of searchResult.value) {
      await prisma.seoSearchOpportunity.upsert({
        where: { siteId_keyword: { siteId, keyword: o.keyword } },
        update: {
          intent: o.intent,
          demand: o.demand,
          competition: o.competition,
          existingUrl: o.existingUrl,
          recommendedUrl: o.recommendedUrl,
          contentType: o.contentType,
          opportunityScore: o.opportunityScore,
          reason: o.reason,
          auditId: audit.id,
        },
        create: { ...o, siteId, auditId: audit.id },
      });
    }
  } else {
    console.error("[seo-audit] search stage failed:", searchResult.reason);
    failures.push("search opportunities");
  }

  await persistAudit(audit.id, {
    status: "COMPLETE",
    finishedAt: new Date(),
    error:
      failures.length > 0
        ? `Some AI stages failed (${failures.join(", ")}) — deterministic audit results are complete.`
        : null,
  });

  return audit.id;
}

/** Persist audit fields; no-op if a concurrent run already replaced the row. */
async function persistAudit(
  auditId: string,
  data: Prisma.SeoAuditUpdateManyMutationInput
): Promise<void> {
  const result = await prisma.seoAudit.updateMany({
    where: { id: auditId },
    data,
  });
  if (result.count === 0) {
    console.warn(`[seo-audit] skipped persist — audit ${auditId} is gone`);
  }
}
