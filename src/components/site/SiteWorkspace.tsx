"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileText, Network, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionChecklist } from "@/components/cards/ActionChecklist";
import { AIInsightCard } from "@/components/cards/AIInsightCard";
import { ExpandableAuditPanel } from "@/components/cards/ExpandableAuditPanel";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  GenerateActionButton,
  kindForRecommendation,
} from "@/components/cards/GenerateAction";
import { IssueCard } from "@/components/cards/IssueCard";
import { PageHealthCard } from "@/components/cards/PageHealthCard";
import { RecommendationCard } from "@/components/cards/RecommendationCard";
import { ScoreCard } from "@/components/cards/ScoreCard";
import { TimelineCard } from "@/components/cards/TimelineCard";
import { TrendChart } from "@/components/cards/TrendChart";
import { AutoFixPanel } from "@/components/AutoFixPanel";
import { CompetitorPanel } from "@/components/CompetitorPanel";
import { SimulationPanel } from "@/components/SimulationPanel";
import { VisibilityPanel } from "@/components/VisibilityPanel";
import { formatDate, hostOf, scoreTone } from "@/lib/utils";
import type { ScanResult } from "@/lib/types";

const TABS = [
  "overview",
  "summary",
  "recommendations",
  "pages",
  "visibility",
  "entities",
  "schema",
  "audit",
  "competitors",
  "history",
] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  summary: "Executive Summary",
  recommendations: "Recommendations",
  pages: "Pages",
  visibility: "AI Visibility",
  entities: "Entities",
  schema: "Schema",
  audit: "Technical Audit",
  competitors: "Competitors",
  history: "History",
};

interface SiteMeta {
  siteId: string;
  url: string;
  latestScanId: string | null;
  latestCompleteScanId: string | null;
  scans: {
    id: string;
    status: string;
    createdAt: string;
    finishedAt: string | null;
    pagesCrawled: number;
  }[];
}

const sortByImpact = <T extends { impact: "high" | "medium" | "low" }>(arr: T[]) =>
  [...arr].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.impact] - rank[b.impact];
  });

export function SiteWorkspace({ siteId }: { siteId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "overview";

  const [meta, setMeta] = useState<SiteMeta | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollTick, setPollTick] = useState(0);
  const [rescanning, setRescanning] = useState(false);

  const setTab = useCallback(
    (next: string) => {
      router.replace(`/sites/${siteId}?tab=${next}`, { scroll: false });
    },
    [router, siteId]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMeta(null);
    setScan(null);
    setScanError(null);
    (async () => {
      const res = await fetch(`/api/me/sites/${siteId}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (!cancelled) {
          setError(j.error ?? "Failed to load site.");
          setLoading(false);
        }
        return;
      }
      const json: SiteMeta = await res.json();
      if (cancelled) return;
      setMeta(json);
      const scanId = json.latestCompleteScanId ?? json.latestScanId;
      if (scanId) {
        const scanRes = await fetch(`/api/scans/${scanId}`, { cache: "no-store" });
        if (cancelled) return;
        if (scanRes.ok) {
          setScan(await scanRes.json());
        } else {
          setScan(null);
          const j = await scanRes.json().catch(() => ({}));
          setScanError(j.error ?? "Could not load scan report.");
        }
      } else {
        setScan(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, pollTick]);

  async function rescan() {
    const scanId = meta?.latestScanId;
    if (!scanId || rescanning) return;
    setRescanning(true);
    try {
      const res = await fetch(`/api/scans/${scanId}/rescan`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.scanId) {
        router.push(`/scan/${data.scanId}`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to start scan.");
      router.push(`/scan/${data.scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan.");
      setRescanning(false);
    }
  }

  const analysis = scan?.analysis ?? null;
  const runningScan = meta?.scans.find((s) =>
    ["QUEUED", "CRAWLING", "ANALYZING"].includes(s.status)
  );

  const trendData = useMemo(
    () =>
      (scan?.history ?? [])
        .filter((h) => h.status === "COMPLETE")
        .slice()
        .reverse()
        .map((h) => ({
          date: formatDate(h.finishedAt ?? h.createdAt),
          geo: h.geoOverall,
          understanding: h.understanding,
        })),
    [scan?.history]
  );

  const deltas = useMemo(() => {
    const completed = (scan?.history ?? []).filter(
      (h) => h.status === "COMPLETE" && h.geoOverall != null
    );
    if (completed.length < 2) return { geo: null, understanding: null };
    return {
      geo: (completed[0].geoOverall ?? 0) - (completed[1].geoOverall ?? 0),
      understanding:
        (completed[0].understanding ?? 0) - (completed[1].understanding ?? 0),
    };
  }, [scan?.history]);

  const title = meta ? hostOf(meta.url) : "Site";
  const showReportLoading =
    loading || (!!meta?.latestCompleteScanId && !scan && !scanError);
  const showEmpty =
    !loading && meta && !scan && !runningScan && !meta.latestCompleteScanId;

  if (error) {
    return (
      <AppShell title={title} breadcrumb="Sites" subtitle={error}>
        <Card className="p-8 text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/sites" className="btn-primary mt-6 inline-block">
            Back to sites
          </Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={title}
      breadcrumb="Sites"
      subtitle={meta?.url}
      actions={
        <>
          {scan && (
            <GenerateActionButton scanId={scan.id} kind="brief" variant="secondary" size="md" />
          )}
          <Button onClick={rescan} disabled={rescanning || !meta?.latestScanId}>
            <RefreshCw className="h-4 w-4" />
            {rescanning ? "Starting…" : "Run new scan"}
          </Button>
        </>
      }
    >
      {runningScan && (
        <FadeIn>
          <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-sky-200 bg-sky-50/60 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-500" />
              <p className="text-sm text-sky-800">
                A scan is running — {runningScan.pagesCrawled} pages so far.
                Results below are from the last completed scan.
              </p>
            </div>
            <Link
              href={`/scan/${runningScan.id}`}
              className="text-sm font-medium text-sky-600 hover:underline"
            >
              Watch progress →
            </Link>
          </Card>
        </FadeIn>
      )}

      {!meta && loading && (
        <Card className="flex flex-col items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-sky-500" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading site…
          </p>
        </Card>
      )}

      {showReportLoading && meta && (
        <Card className="flex flex-col items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-sky-500" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading report…
          </p>
          <p className="mt-1 text-xs text-slate-400">{hostOf(meta.url)}</p>
        </Card>
      )}

      {scanError && !scan && !loading && (
        <Card className="p-8 text-center">
          <p className="text-red-600">{scanError}</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => setPollTick((t) => t + 1)}
          >
            Try again
          </Button>
        </Card>
      )}

      {showEmpty && (
        <Card className="p-10 text-center">
          <p className="font-medium text-slate-700">No scans yet for this site.</p>
          <p className="mt-1 text-sm text-slate-400">
            Run your first scan to see AI visibility insights.
          </p>
          <Button className="mt-6" onClick={rescan} disabled={rescanning}>
            {rescanning ? "Starting…" : "Run first scan"}
          </Button>
        </Card>
      )}

      {scan && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {TAB_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ---------- OVERVIEW: What should I look at? ---------- */}
          <TabsContent value="overview">
            {analysis ? (
              <FadeIn className="flex flex-col gap-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <ScoreCard
                    label="GEO Score"
                    score={analysis.geoScore.overall}
                    delta={deltas.geo}
                    showGrade
                    explanation="How optimized this site is for generative engines, across 13 components."
                  />
                  <ScoreCard
                    label="AI Understanding"
                    score={analysis.understanding.confidence}
                    delta={deltas.understanding}
                    explanation="How confidently an AI can say what you do, for whom, and where."
                  />
                  <ScoreCard
                    label="AI Visibility"
                    score={
                      scan.visibility?.status === "COMPLETE"
                        ? (scan.visibility.results?.overall ?? null)
                        : null
                    }
                    suffix="%"
                    explanation={
                      scan.visibility?.status === "COMPLETE"
                        ? "Modeled likelihood assistants surface this site."
                        : "Not scored yet — run it from the AI Visibility tab."
                    }
                    icon={<Eye className="h-4 w-4" />}
                  />
                  <ScoreCard
                    label="Pages crawled"
                    score={scan.pagesCrawled}
                    suffix=""
                    explanation={`Last scan ${formatDate(scan.finishedAt ?? scan.createdAt)}. Content below reflects these pages.`}
                    icon={<FileText className="h-4 w-4" />}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-5">
                  <Card className="lg:col-span-3">
                    <CardHeader>
                      <CardTitle>Score trend</CardTitle>
                      <CardDescription>
                        GEO and understanding across scans
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TrendChart
                        data={trendData}
                        series={[
                          { key: "geo", label: "GEO Score" },
                          { key: "understanding", label: "AI Understanding" },
                        ]}
                      />
                    </CardContent>
                  </Card>

                  <div className="flex flex-col gap-4 lg:col-span-2">
                    <Card className="flex-1 p-5">
                      <p className="text-sm font-semibold text-slate-900">
                        Top wins available
                      </p>
                      <ul className="mt-3 flex flex-col gap-2">
                        {sortByImpact(analysis.recommendations)
                          .slice(0, 3)
                          .map((r) => (
                            <li
                              key={r.title}
                              className="flex items-start gap-2 text-sm text-slate-600"
                            >
                              <Badge tone="positive" className="mt-0.5 shrink-0">
                                {r.impact}
                              </Badge>
                              <span>{r.title}</span>
                            </li>
                          ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setTab("recommendations")}
                        className="mt-4 text-sm font-medium text-sky-600 hover:underline"
                      >
                        See all recommendations →
                      </button>
                    </Card>
                    <Card className="flex-1 p-5">
                      <p className="text-sm font-semibold text-slate-900">
                        Top issues
                      </p>
                      <ul className="mt-3 flex flex-col gap-2">
                        {analysis.understanding.problems.slice(0, 3).map((p) => (
                          <li
                            key={p.issue}
                            className="flex items-start gap-2 text-sm text-slate-600"
                          >
                            <Badge tone="warning" className="mt-0.5 shrink-0">
                              issue
                            </Badge>
                            <span>{p.issue}</span>
                          </li>
                        ))}
                        {analysis.understanding.problems.length === 0 && (
                          <li className="text-sm text-slate-400">
                            No blocking issues found. Nice.
                          </li>
                        )}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setTab("summary")}
                        className="mt-4 text-sm font-medium text-sky-600 hover:underline"
                      >
                        Read the executive summary →
                      </button>
                    </Card>
                  </div>
                </div>

                <ActionChecklist
                  actions={sortByImpact(analysis.recommendations)
                    .slice(0, 5)
                    .map((r, i) => ({
                      id: `${i}-${r.title}`,
                      title: r.title,
                      impact: r.impact,
                      effort: r.effort,
                      detail: r.why,
                      cta: (
                        <GenerateActionButton
                          scanId={scan.id}
                          kind={kindForRecommendation(r)}
                          topic={r.title}
                        />
                      ),
                    }))}
                />
              </FadeIn>
            ) : (
              <Card className="p-8 text-center text-sm text-slate-500">
                Analysis not available for this scan yet.
              </Card>
            )}
          </TabsContent>

          {/* ---------- EXECUTIVE SUMMARY: What does AI think of us? ---------- */}
          <TabsContent value="summary">
            {analysis && (
              <FadeIn className="flex flex-col gap-4">
                <AIInsightCard
                  title="What AI thinks you do"
                  insight={analysis.understanding.businessSummary}
                  meta={
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="info">
                        Audience: {analysis.understanding.audience}
                      </Badge>
                      <Badge tone="info">
                        Area: {analysis.understanding.serviceArea}
                      </Badge>
                      <Badge
                        tone={scoreTone(analysis.understanding.confidence)}
                      >
                        Confidence {analysis.understanding.confidence}/100
                      </Badge>
                    </div>
                  }
                />

                {analysis.understanding.differentiators.length > 0 && (
                  <Card className="p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      What sets you apart (according to your site)
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis.understanding.differentiators.map((d) => (
                        <Badge key={d} tone="positive">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {analysis.understanding.problems.map((p) => (
                    <IssueCard key={p.issue} issue={p.issue} detail={p.detail} />
                  ))}
                </div>

                <Card className="p-5">
                  <p className="text-sm font-semibold text-slate-900">
                    Biggest opportunity right now
                  </p>
                  {analysis.contentGaps[0] ? (
                    <>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        Users ask AI assistants{" "}
                        <span className="font-medium text-slate-900">
                          “{analysis.contentGaps[0].question}”
                        </span>{" "}
                        — and your site can&apos;t answer it today.{" "}
                        {analysis.contentGaps[0].whyItMatters}
                      </p>
                      <div className="mt-4">
                        <GenerateActionButton
                          scanId={scan.id}
                          kind="faq"
                          topic={analysis.contentGaps[0].question}
                          variant="primary"
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      No unanswered questions found — check Content Opportunities
                      after your next scan.
                    </p>
                  )}
                </Card>
              </FadeIn>
            )}
          </TabsContent>

          {/* ---------- RECOMMENDATIONS ---------- */}
          <TabsContent value="recommendations">
            {analysis && (
              <FadeIn className="flex flex-col gap-4">
                {sortByImpact(analysis.recommendations).map((r) => (
                  <RecommendationCard key={r.title} rec={r} scanId={scan.id} />
                ))}
              </FadeIn>
            )}
          </TabsContent>

          {/* ---------- PAGES ---------- */}
          <TabsContent value="pages">
            <FadeIn className="flex flex-col gap-4">
              <p className="text-sm text-slate-500">
                {scan.pages.length} pages crawled. Health is based on titles,
                status codes, and content depth.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {scan.pages.map((p) => (
                  <PageHealthCard key={p.url} page={p} />
                ))}
              </div>
            </FadeIn>
          </TabsContent>

          {/* ---------- AI VISIBILITY ---------- */}
          <TabsContent value="visibility">
            <FadeIn className="flex flex-col gap-4">
              <VisibilityPanel
                scanId={scan.id}
                visibility={scan.visibility}
                geoOverall={analysis?.geoScore.overall ?? null}
                onStarted={() => setPollTick((t) => t + 1)}
              />
              <SimulationPanel
                scanId={scan.id}
                simulation={scan.simulation}
                onStarted={() => setPollTick((t) => t + 1)}
              />
            </FadeIn>
          </TabsContent>

          {/* ---------- ENTITIES ---------- */}
          <TabsContent value="entities">
            {analysis && (
              <FadeIn className="flex flex-col gap-4">
                <Card className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-none bg-violet-50 text-violet-500">
                      <Network className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Primary topic
                      </p>
                      <p className="text-lg font-semibold text-violet-600">
                        {analysis.semanticMap.topic}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    AI doesn&apos;t index pages — it maps concepts. These are the
                    entities your site currently establishes.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.semanticMap.subtopics.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </Card>
                <AIInsightCard
                  title="Strengthen your entity graph"
                  insight="Add or deepen pages for the subtopics closest to revenue, and name your business, services, and locations consistently across pages. Consistent entities are what let assistants connect 'who you are' to 'what users ask'."
                  meta={
                    <GenerateActionButton
                      scanId={scan.id}
                      kind="brief"
                      topic={`Entity coverage for ${analysis.semanticMap.topic}`}
                    />
                  }
                />
              </FadeIn>
            )}
          </TabsContent>

          {/* ---------- SCHEMA ---------- */}
          <TabsContent value="schema">
            <FadeIn className="flex flex-col gap-4">
              {analysis && (
                <AIInsightCard
                  title="Why schema matters"
                  insight="Structured data is the most machine-readable signal you control. Publish it via your CMS or approve the generated JSON-LD below to serve it through geo.js."
                  meta={
                    <GenerateActionButton
                      scanId={scan.id}
                      kind="schema"
                      variant="primary"
                    />
                  }
                />
              )}
              <AutoFixPanel scanId={scan.id} />
            </FadeIn>
          </TabsContent>

          {/* ---------- TECHNICAL AUDIT ---------- */}
          <TabsContent value="audit">
            {analysis && (
              <FadeIn className="flex flex-col gap-4">
                <p className="text-sm text-slate-500">
                  All 13 GEO components. Expand a row only when you need the
                  findings — quick wins are listed inside.
                </p>
                <ExpandableAuditPanel
                  sections={analysis.geoScore.components.map((c) => ({
                    id: c.name,
                    title: c.name,
                    summary: c.findings,
                    tone: scoreTone(c.score),
                    badge: `${c.score}/100`,
                    children: (
                      <div className="flex flex-col gap-3 text-sm">
                        <p className="leading-relaxed text-slate-600">
                          {c.findings}
                        </p>
                        <div className="rounded-none border border-emerald-100 bg-emerald-50/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                            Quick win
                          </p>
                          <p className="mt-1 text-emerald-800">{c.quickWin}</p>
                        </div>
                      </div>
                    ),
                  }))}
                />
                <ExpandableAuditPanel
                  sections={[
                    {
                      id: "crawl-data",
                      title: "Raw crawl data",
                      summary: `${scan.pages.length} pages with titles, status codes, and word counts.`,
                      badge: `${scan.pages.length} pages`,
                      tone: "neutral",
                      children: (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-left text-slate-400">
                                <th className="py-2 pr-4 font-medium">URL</th>
                                <th className="py-2 pr-4 font-medium">Title</th>
                                <th className="py-2 pr-4 font-medium text-right">
                                  Status
                                </th>
                                <th className="py-2 font-medium text-right">
                                  Words
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {scan.pages.map((p) => (
                                <tr key={p.url} className="border-b border-slate-100">
                                  <td className="max-w-xs truncate py-2 pr-4 text-slate-700">
                                    {p.url}
                                  </td>
                                  <td className="max-w-sm truncate py-2 pr-4 text-slate-500">
                                    {p.title ?? "—"}
                                  </td>
                                  <td className="py-2 pr-4 text-right font-mono text-slate-500">
                                    {p.statusCode ?? "—"}
                                  </td>
                                  <td className="py-2 text-right font-mono text-slate-500">
                                    {p.wordCount}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ),
                    },
                  ]}
                />
              </FadeIn>
            )}
          </TabsContent>

          {/* ---------- COMPETITORS ---------- */}
          <TabsContent value="competitors">
            <FadeIn>
              <CompetitorPanel scanId={scan.id} />
            </FadeIn>
          </TabsContent>

          {/* ---------- HISTORY ---------- */}
          <TabsContent value="history">
            <FadeIn className="grid gap-4 lg:grid-cols-2">
              <TimelineCard
                entries={scan.history ?? []}
                currentScanId={scan.id}
              />
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Trend</CardTitle>
                    <CardDescription>Scores across completed scans</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrendChart
                      data={trendData}
                      series={[
                        { key: "geo", label: "GEO Score" },
                        { key: "understanding", label: "AI Understanding" },
                      ]}
                      height={180}
                    />
                  </CardContent>
                </Card>
                {scan.comparison && scan.comparison.highlights.length > 0 && (
                  <Card className="p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      Since your last scan
                    </p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {scan.comparison.highlights.map((h) => (
                        <li
                          key={h}
                          className="rounded-none border border-sky-100 bg-sky-50/70 px-3 py-2 text-sm text-sky-800"
                        >
                          {h}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </FadeIn>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
