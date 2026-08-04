"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SimulationPanel } from "@/components/SimulationPanel";
import { VisibilityPanel } from "@/components/VisibilityPanel";
import { ContinuousLearningPanel } from "@/components/ContinuousLearningPanel";
import { AutoFixPanel } from "@/components/AutoFixPanel";
import { CompetitorPanel } from "@/components/CompetitorPanel";
import type { ScanResult } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function barColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="10"
            className="stroke-slate-200"
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
            className={
              score >= 75
                ? "stroke-emerald-500"
                : score >= 50
                  ? "stroke-amber-500"
                  : "stroke-red-500"
            }
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${scoreColor(score)}`}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const impactStyles: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-800",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-slate-100 text-slate-600",
};

export function ScanDashboard({ scanId }: { scanId: string }) {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pollTick, setPollTick] = useState(0);

  const isRunning =
    !scan || scan.status === "QUEUED" || scan.status === "CRAWLING" || scan.status === "ANALYZING";

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/scans/${scanId}`, { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        const data: ScanResult = await res.json();
        if (cancelled) return;
        setScan(data);
        const scanBusy =
          data.status === "QUEUED" ||
          data.status === "CRAWLING" ||
          data.status === "ANALYZING";
        const simulationBusy = data.simulation?.status === "RUNNING";
        const visibilityBusy = data.visibility?.status === "RUNNING";
        if (scanBusy || simulationBusy || visibilityBusy) {
          timer = setTimeout(poll, 2000);
        }
      } catch (err) {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "Failed to load scan.");
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanId, pollTick]);

  if (fetchError) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600">{fetchError}</p>
          <Link href="/" className="mt-4 inline-block text-sky-500 hover:underline">
            Start a new scan
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="brand-wordmark text-base">
            Geo<span className="brand-wordmark-accent">Archer</span>
          </Link>
          <h1 className="mt-1 text-2xl font-bold break-all text-slate-900">
            {scan?.siteUrl ?? "Loading…"}
          </h1>
          {scan?.benchmarkScanId && (
            <Link
              href={`/scan/${scan.benchmarkScanId}`}
              className="mt-2 inline-block text-sm text-sky-500 hover:underline"
            >
              ← Back to primary comparison
            </Link>
          )}
        </div>
        <Link
          href="/"
          className="btn-secondary text-sm"
        >
          New scan
        </Link>
      </header>

      {isRunning && (
        <div className="card p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-400" />
          <p className="text-lg font-medium">
            {!scan || scan.status === "QUEUED"
              ? "Queued…"
              : scan.status === "CRAWLING"
                ? `Crawling your site — ${scan.pagesCrawled} page${scan.pagesCrawled === 1 ? "" : "s"} so far`
                : "Running AI analysis — understanding, GEO score, gaps, recommendations"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            This usually takes one to three minutes.
          </p>
        </div>
      )}

      {scan?.status === "FAILED" && (
        <div className="card border-red-200 bg-red-50 p-8 text-center">
          <p className="text-lg font-semibold text-red-700">Scan failed</p>
          <p className="mt-2 text-sm text-red-600">{scan.error}</p>
        </div>
      )}

      {scan?.status === "COMPLETE" && scan.analysis && (
        <div className="flex flex-col gap-6">
          {/* Scores */}
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-around gap-8">
              <ScoreRing score={scan.analysis.geoScore.overall} label="GEO Score" />
              <ScoreRing
                score={scan.analysis.understanding.confidence}
                label="AI Understanding"
              />
              <div className="max-w-md">
                <h2 className="text-sm font-mono uppercase tracking-wide text-slate-500">
                  What AI thinks you do
                </h2>
                <p className="mt-2 leading-relaxed">
                  {scan.analysis.understanding.businessSummary}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  <span className="text-slate-700">Audience:</span>{" "}
                  {scan.analysis.understanding.audience} ·{" "}
                  <span className="text-slate-700">Area:</span>{" "}
                  {scan.analysis.understanding.serviceArea}
                </p>
              </div>
            </div>
          </div>

          <VisibilityPanel
            scanId={scan.id}
            visibility={scan.visibility}
            geoOverall={scan.analysis.geoScore.overall}
            onStarted={() => setPollTick((t) => t + 1)}
          />

          {!scan.benchmarkScanId && (
            <CompetitorPanel scanId={scan.id} primarySiteUrl={scan.siteUrl} />
          )}

          {/* Semantic map */}
          <Section
            title="Semantic map"
            subtitle="AI doesn't see pages — it sees concepts. This is what your site is 'about'."
          >
            <p className="font-semibold text-sky-600">
              {scan.analysis.semanticMap.topic}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scan.analysis.semanticMap.subtopics.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>

          {/* Understanding problems */}
          {scan.analysis.understanding.problems.length > 0 && (
            <Section
              title="Why AI isn't more confident"
              subtitle="Specific gaps lowering your AI Understanding score."
            >
              <ul className="flex flex-col gap-3">
                {scan.analysis.understanding.problems.map((p) => (
                  <li
                    key={p.issue}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-medium text-amber-300">{p.issue}</p>
                    <p className="mt-1 text-sm text-slate-500">{p.detail}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* GEO components */}
          <Section
            title="GEO score breakdown"
            subtitle="13 components of Generative Engine Optimization, scored by GeoArcher's model."
          >
            <div className="flex flex-col gap-4">
              {scan.analysis.geoScore.components.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className={`font-mono ${scoreColor(c.score)}`}>
                      {c.score}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${barColor(c.score)}`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-sm text-slate-500">{c.findings}</p>
                  <p className="mt-0.5 text-sm text-emerald-700">
                    Quick win: {c.quickWin}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          {/* Content gaps */}
          <Section
            title="AI content gaps"
            subtitle="Questions users ask AI assistants that your site can't answer today."
          >
            <ul className="flex flex-col gap-3">
              {scan.analysis.contentGaps.map((g) => (
                <li
                  key={g.question}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="font-medium">“{g.question}”</p>
                  <p className="mt-1 text-sm text-slate-500">{g.whyItMatters}</p>
                </li>
              ))}
            </ul>
          </Section>

          {/* Recommendations */}
          <Section
            title="Recommendations"
            subtitle="Specific actions, ranked by impact — no keyword stuffing."
          >
            <ul className="flex flex-col gap-3">
              {[...scan.analysis.recommendations]
                .sort((a, b) => {
                  const rank = { high: 0, medium: 1, low: 2 };
                  return rank[a.impact] - rank[b.impact];
                })
                .map((r) => (
                  <li
                    key={r.title}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${impactStyles[r.impact]}`}
                      >
                        {r.impact} impact
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {r.effort} effort
                      </span>
                      <span className="text-xs text-slate-400">{r.category}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{r.why}</p>
                    <p className="mt-1 text-sm text-slate-700">{r.how}</p>
                  </li>
                ))}
            </ul>
          </Section>

          {/* Auto-fix (Phase 7) */}
          <AutoFixPanel scanId={scan.id} />

          {/* Answer simulation */}
          <SimulationPanel
            scanId={scan.id}
            simulation={scan.simulation}
            onStarted={() => setPollTick((t) => t + 1)}
          />

          {/* Continuous learning (Phase 8) */}
          <ContinuousLearningPanel
            scanId={scan.id}
            history={scan.history}
            comparison={scan.comparison}
          />

          {/* Crawled pages */}
          <Section title={`Pages crawled (${scan.pages.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">URL</th>
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 font-medium text-right">Words</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.pages.map((p) => (
                    <tr key={p.url} className="border-b border-slate-100">
                      <td className="py-2 pr-4 max-w-xs truncate text-slate-700">
                        {p.url}
                      </td>
                      <td className="py-2 pr-4 max-w-sm truncate text-slate-500">
                        {p.title ?? "—"}
                      </td>
                      <td className="py-2 text-right font-mono text-slate-500">
                        {p.wordCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </main>
  );
}
