"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { ScoreCard } from "@/components/cards/ScoreCard";
import { TrendChart } from "@/components/cards/TrendChart";
import { Skeleton } from "@/components/ui/skeleton";
import { AutopilotCard } from "@/components/seo/AutopilotCard";
import { SeoShell } from "@/components/seo/SeoShell";
import { downloadSeoReportPdf } from "@/lib/seo-report-pdf";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { cn, gradeFor, scoreTone, toneText } from "@/lib/utils";

function SeoOverviewInner() {
  const autopilot = useSeoAutopilot();
  const { overview } = autopilot;
  const [scoreOpen, setScoreOpen] = useState(false);

  const audit = overview?.audit ?? null;
  const categories = audit?.categories ?? [];

  const strong = categories.filter((c) => c.score >= 80);
  const weak = categories.filter((c) => c.score < 70);
  const failingChecks = (audit?.siteChecks ?? []).filter((c) => c.status !== "pass");

  const combined = useMemo(() => {
    if (audit?.overallScore == null || overview?.geoOverall == null) return null;
    return Math.round((audit.overallScore + overview.geoOverall) / 2);
  }, [audit?.overallScore, overview?.geoOverall]);

  const queue = (overview?.opportunities ?? [])
    .filter((o) => o.status !== "DISMISSED" && o.status !== "COMPLETED")
    .slice(0, 5);

  return (
    <SeoShell
      title="SEO Infrastructure"
      subtitle="Technical health behind AI visibility — still available, no longer the headline."
      autopilot={autopilot}
    >
      {overview && !audit && (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {audit && (
        <FadeIn className="space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => overview && downloadSeoReportPdf(overview)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
            >
              <Download className="h-3.5 w-3.5" />
              Download SEO report
            </button>
          </div>

          {/* Visibility health: SEO + GEO + combined */}
          <div className="grid gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setScoreOpen((v) => !v)}
              className="text-left"
            >
              <Card className="h-full p-6 transition hover:border-sky-300">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-500">SEO Score</p>
                  {scoreOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-4xl font-bold tracking-tight",
                      audit.overallScore != null
                        ? toneText[scoreTone(audit.overallScore)]
                        : "text-slate-300"
                    )}
                  >
                    {audit.overallScore ?? "—"}
                  </span>
                  {audit.overallScore != null && (
                    <span className="text-sm font-semibold text-slate-400">
                      Grade {gradeFor(audit.overallScore)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Weighted across {categories.length} dimensions from{" "}
                  {audit.pagesCrawled} crawled pages. Click for the breakdown.
                </p>
              </Card>
            </button>
            <ScoreCard
              label="GEO Score"
              score={overview?.geoOverall ?? null}
              explanation="AI-assistant visibility from your existing GEO analysis."
            />
            <ScoreCard
              label="Combined Visibility"
              score={combined}
              explanation="Average of SEO and GEO — one number for overall discoverability."
              showGrade
            />
          </div>

          {/* Expandable score explanation */}
          {scoreOpen && (
            <Card className="p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Strong areas
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {strong.length === 0 && (
                      <li className="text-sm text-slate-400">
                        No dimension scores 80+ yet.
                      </li>
                    )}
                    {strong.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                        {c.label}
                        <span className="ml-auto font-semibold text-emerald-600">
                          {c.score}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Needs attention
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {weak.length === 0 && (
                      <li className="text-sm text-slate-400">
                        Every dimension scores 70 or better.
                      </li>
                    )}
                    {weak.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        {c.label}
                        <span className="ml-auto font-semibold text-amber-600">
                          {c.score}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {failingChecks.length > 0 && (
                    <p className="mt-3 text-xs text-slate-400">
                      {failingChecks.length} site checks need review —{" "}
                      <Link
                        href={`/seo/technical?site=${overview?.siteId}`}
                        className="text-sky-600 hover:underline"
                      >
                        see Technical SEO
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Category score cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <ScoreCard
                key={c.id}
                label={c.label}
                score={c.score}
                explanation={`${Math.round(c.weight * 100)}% of the SEO score`}
              />
            ))}
          </div>

          {/* Continuous Autopilot */}
          {overview && <AutopilotCard siteId={overview.siteId} />}

          {/* Unified SEO + GEO strengths and opportunities */}
          {(overview?.geoComponents.length ?? 0) > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Visibility health
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Traditional search and AI search, side by side — from one crawl.
              </p>
              <div className="mt-4 grid gap-x-10 gap-y-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    SEO strengths
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {strong.slice(0, 4).map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {c.label}
                      </li>
                    ))}
                    {strong.length === 0 && (
                      <li className="text-sm text-slate-400">None yet</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    SEO opportunities
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {weak.slice(0, 4).map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        {c.label}
                      </li>
                    ))}
                    {weak.length === 0 && (
                      <li className="text-sm text-slate-400">
                        All dimensions at 70+
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    GEO strengths
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {(overview?.geoComponents ?? [])
                      .filter((c) => c.score >= 80)
                      .slice(0, 4)
                      .map((c) => (
                        <li key={c.name} className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          {c.name}
                        </li>
                      ))}
                    {(overview?.geoComponents ?? []).filter((c) => c.score >= 80)
                      .length === 0 && (
                      <li className="text-sm text-slate-400">None yet</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    GEO opportunities
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {(overview?.geoComponents ?? [])
                      .filter((c) => c.score < 60)
                      .sort((a, b) => a.score - b.score)
                      .slice(0, 4)
                      .map((c) => (
                        <li key={c.name} className="flex items-center gap-2 text-sm text-slate-600">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          {c.name}
                        </li>
                      ))}
                    {(overview?.geoComponents ?? []).filter((c) => c.score < 60)
                      .length === 0 && (
                      <li className="text-sm text-slate-400">
                        All components at 60+
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Score over time */}
          {(overview?.history.length ?? 0) >= 2 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                SEO score over time
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                One point per completed audit — audits run automatically after
                each scheduled recrawl.
              </p>
              <div className="mt-4">
                <TrendChart
                  data={(overview?.history ?? []).map((h) => ({
                    date: new Date(h.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    }),
                    seo: h.overall,
                  }))}
                  series={[{ key: "seo", label: "SEO Score" }]}
                  height={200}
                />
              </div>
            </Card>
          )}

          {/* Issue totals */}
          {audit.totals && (
            <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 p-5 text-sm">
              <p className="font-medium text-slate-700">
                {audit.pagesCrawled} pages analyzed
              </p>
              <p className="text-red-600">
                {audit.totals.critical} critical issues
              </p>
              <p className="text-amber-600">{audit.totals.warning} warnings</p>
              <p className="text-slate-500">{audit.totals.info} suggestions</p>
              <Link
                href={`/seo/pages?site=${overview?.siteId}`}
                className="ml-auto inline-flex items-center gap-1 text-sky-600 hover:underline"
              >
                Page-level audit <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          )}

          {/* Priority queue */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                What should I do next?
              </h2>
              <Link
                href={`/seo/opportunities?site=${overview?.siteId}`}
                className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline"
              >
                All opportunities <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {queue.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-400">
                No open opportunities — re-run the audit after your next scan.
              </Card>
            ) : (
              <Card className="divide-y divide-slate-100 p-0">
                {queue.map((opp, i) => (
                  <Link
                    key={opp.id}
                    href={`/seo/opportunities?site=${overview?.siteId}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {opp.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Impact{" "}
                        <span className="font-medium capitalize text-slate-500">
                          {opp.impact}
                        </span>{" "}
                        · Difficulty{" "}
                        <span className="font-medium capitalize text-slate-500">
                          {opp.difficulty}
                        </span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-lg font-bold",
                        toneText[scoreTone(opp.opportunityScore)]
                      )}
                    >
                      {opp.opportunityScore}
                    </span>
                  </Link>
                ))}
              </Card>
            )}
          </div>
        </FadeIn>
      )}
    </SeoShell>
  );
}

export default function SeoOverviewPage() {
  return (
    <Suspense>
      <SeoOverviewInner />
    </Suspense>
  );
}
