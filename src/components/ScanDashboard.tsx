"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ScanResult } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
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
            className="stroke-neutral-800"
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
      <span className="text-sm text-neutral-400">{label}</span>
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
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const impactStyles: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-neutral-500/15 text-neutral-300",
};

export function ScanDashboard({ scanId }: { scanId: string }) {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
        if (
          data.status === "QUEUED" ||
          data.status === "CRAWLING" ||
          data.status === "ANALYZING"
        ) {
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
  }, [scanId]);

  if (fetchError) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400">{fetchError}</p>
          <Link href="/" className="mt-4 inline-block text-emerald-400 underline">
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
          <Link href="/" className="text-sm font-mono uppercase tracking-widest text-emerald-400">
            GeoArcher
          </Link>
          <h1 className="mt-1 text-2xl font-bold break-all">
            {scan?.siteUrl ?? "Loading…"}
          </h1>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
        >
          New scan
        </Link>
      </header>

      {isRunning && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-400" />
          <p className="text-lg font-medium">
            {!scan || scan.status === "QUEUED"
              ? "Queued…"
              : scan.status === "CRAWLING"
                ? `Crawling your site — ${scan.pagesCrawled} page${scan.pagesCrawled === 1 ? "" : "s"} so far`
                : "Running AI analysis — understanding, GEO score, gaps, recommendations"}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            This usually takes one to three minutes.
          </p>
        </div>
      )}

      {scan?.status === "FAILED" && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-8 text-center">
          <p className="text-lg font-semibold text-red-300">Scan failed</p>
          <p className="mt-2 text-sm text-red-200/80">{scan.error}</p>
        </div>
      )}

      {scan?.status === "COMPLETE" && scan.analysis && (
        <div className="flex flex-col gap-6">
          {/* Scores */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="flex flex-wrap items-center justify-around gap-8">
              <ScoreRing score={scan.analysis.geoScore.overall} label="GEO Score" />
              <ScoreRing
                score={scan.analysis.understanding.confidence}
                label="AI Understanding"
              />
              <div className="max-w-md">
                <h2 className="text-sm font-mono uppercase tracking-wide text-neutral-400">
                  What AI thinks you do
                </h2>
                <p className="mt-2 leading-relaxed">
                  {scan.analysis.understanding.businessSummary}
                </p>
                <p className="mt-3 text-sm text-neutral-400">
                  <span className="text-neutral-300">Audience:</span>{" "}
                  {scan.analysis.understanding.audience} ·{" "}
                  <span className="text-neutral-300">Area:</span>{" "}
                  {scan.analysis.understanding.serviceArea}
                </p>
              </div>
            </div>
          </div>

          {/* Semantic map */}
          <Section
            title="Semantic map"
            subtitle="AI doesn't see pages — it sees concepts. This is what your site is 'about'."
          >
            <p className="font-semibold text-emerald-300">
              {scan.analysis.semanticMap.topic}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scan.analysis.semanticMap.subtopics.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm text-neutral-300"
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
                    className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
                  >
                    <p className="font-medium text-amber-300">{p.issue}</p>
                    <p className="mt-1 text-sm text-neutral-400">{p.detail}</p>
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
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full rounded-full ${barColor(c.score)}`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-400">{c.findings}</p>
                  <p className="mt-0.5 text-sm text-emerald-300/90">
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
                  className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
                >
                  <p className="font-medium">“{g.question}”</p>
                  <p className="mt-1 text-sm text-neutral-400">{g.whyItMatters}</p>
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
                    className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${impactStyles[r.impact]}`}
                      >
                        {r.impact} impact
                      </span>
                      <span className="rounded-full bg-neutral-700/40 px-2 py-0.5 text-xs text-neutral-300">
                        {r.effort} effort
                      </span>
                      <span className="text-xs text-neutral-500">{r.category}</span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-400">{r.why}</p>
                    <p className="mt-1 text-sm text-neutral-300">{r.how}</p>
                  </li>
                ))}
            </ul>
          </Section>

          {/* Crawled pages */}
          <Section title={`Pages crawled (${scan.pages.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left text-neutral-400">
                    <th className="py-2 pr-4 font-medium">URL</th>
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 font-medium text-right">Words</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.pages.map((p) => (
                    <tr key={p.url} className="border-b border-neutral-800/60">
                      <td className="py-2 pr-4 max-w-xs truncate text-neutral-300">
                        {p.url}
                      </td>
                      <td className="py-2 pr-4 max-w-sm truncate text-neutral-400">
                        {p.title ?? "—"}
                      </td>
                      <td className="py-2 text-right font-mono text-neutral-400">
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
