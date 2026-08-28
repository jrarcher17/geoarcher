"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { GenerateActionButton, kindForRecommendation } from "@/components/cards/GenerateAction";
import {
  EmptyState,
  EngineBar,
  ImpactBadge,
  SectionLabel,
  WorkRow,
} from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { explainVisibility } from "@/lib/opportunity-buckets";
import { useInsights } from "@/lib/useInsights";
import { hostOf } from "@/lib/utils";

const ENGINE_ALIASES: Record<string, string> = {
  ChatGPT: "ChatGPT",
  Claude: "Claude",
  Gemini: "Gemini",
  Perplexity: "Perplexity",
  Copilot: "Google AI",
};

export default function DashboardPage() {
  const { data, error, loading } = useInsights();
  const [revealOpen, setRevealOpen] = useState(true);

  const stats = useMemo(() => {
    const sites = data?.sites ?? [];
    const analyzed = sites.filter((s) => s.analysis);
    const visibilitySites = sites.filter((s) => s.visibility);
    const avg = (vals: number[]) =>
      vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;

    const avgVisibility = avg(visibilitySites.map((s) => s.visibility!.overall));
    const prevVisibility = avg(
      sites
        .map((s) => {
          if (s.history.length < 2) return null;
          return s.visibility?.overall ?? null;
        })
        .filter((n): n is number => n != null)
    );
    const delta =
      avgVisibility != null && prevVisibility != null
        ? avgVisibility - prevVisibility
        : null;

    const engines = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot"].map(
      (name) => {
        const scores = visibilitySites
          .map((s) => s.visibility!.assistants.find((a) => a.assistant === name)?.score)
          .filter((n): n is number => n != null);
        return { name: ENGINE_ALIASES[name] ?? name, score: avg(scores) };
      }
    );

    const open = sites.reduce((n, s) => n + s.openOpportunities, 0);
    const completed = sites.reduce((n, s) => n + s.completedOpportunities, 0);
    const buckets = new Map<string, number>();
    for (const s of sites) {
      for (const b of s.opportunityBuckets) {
        buckets.set(b.label, (buckets.get(b.label) ?? 0) + b.count);
      }
    }

    const highImpact = sites
      .flatMap((s) =>
        (s.analysis?.recommendations ?? []).map((rec) => ({
          rec,
          site: s,
          scanId: data?.scanIds[s.siteId] ?? null,
        }))
      )
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[a.rec.impact] - rank[b.rec.impact];
      })
      .slice(0, 3);

    const working = {
      technical: sites.some((s) => s.seoOverall != null),
      structured: sites.some((s) => s.layerEnabled || (s.seoOverall ?? 0) > 0),
      entities: analyzed.some((s) =>
        s.analysis!.components.some((c) => c.name === "Entity Coverage")
      ),
      links: sites.some((s) =>
        s.opportunityBuckets.some((b) => b.label === "Internal Linking")
      ),
      gaps: analyzed.some((s) => s.analysis!.contentGaps.length > 0),
      visibility: visibilitySites.length > 0,
      competitors: false,
    };

    const first = analyzed[0];
    const wow =
      analyzed.length === 1 && first
        ? {
            host: hostOf(first.url),
            seo: first.seoOverall,
            visibility: first.visibility?.overall ?? first.analysis!.geoOverall,
            geo: first.analysis!.geoOverall,
            examples: first.analysis!.contentGaps.slice(0, 3),
            auto: completed,
            content: first.analysis!.contentGaps.length,
            recs: first.analysis!.recommendations.length,
          }
        : null;

    return {
      total: sites.length,
      analyzed: analyzed.length,
      avgVisibility,
      delta,
      engines,
      open,
      completed,
      buckets: [...buckets.entries()].sort((a, b) => b[1] - a[1]),
      highImpact,
      working,
      wow,
      running: sites.filter((s) =>
        ["QUEUED", "CRAWLING", "ANALYZING"].includes(s.latestScan?.status ?? "")
      ).length,
    };
  }, [data]);

  return (
    <AppShell
      title="AI Visibility"
      subtitle="How visible your business is — and what GEO Archer is doing about it."
      live={stats.running > 0}
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-56 lg:col-span-2" />
          <Skeleton className="h-56" />
        </div>
      )}

      {data && data.sites.length === 0 && (
        <EmptyState
          title="Connect your website to begin analyzing AI visibility"
          body="Add a site and GEO Archer will crawl it, understand the business, and find where you lose visibility in Google and AI search."
          actionHref="/sites"
          actionLabel="Add Website"
        />
      )}

      {data && data.sites.length > 0 && stats.analyzed === 0 && (
        <EmptyState
          title="Your first analysis is the next step"
          body="GEO Archer has your site. Run a scan to understand the business and measure AI visibility."
          actionHref="/sites"
          actionLabel="Analyze Website"
        />
      )}

      {data && stats.analyzed > 0 && (
        <FadeIn className="flex flex-col gap-8">
          {stats.wow && revealOpen && (
            <section className="border border-slate-200 bg-white p-6 sm:p-8">
              <SectionLabel>First look</SectionLabel>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                We found something important.
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {stats.wow.host} looks technically capable
                {stats.wow.seo != null ? ` (SEO ${stats.wow.seo})` : ""}, but AI
                visibility is weaker ({stats.wow.visibility}).
              </p>
              {stats.wow.examples.length > 0 && (
                <ul className="mt-5 space-y-2 text-sm text-slate-600">
                  {stats.wow.examples.map((g) => (
                    <li key={g.question}>
                      <span className="font-medium text-slate-900">{g.question}</span>
                      <span className="text-slate-400"> — {g.whyItMatters}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-5 text-sm text-slate-700">
                GEO Archer found{" "}
                <strong>{stats.open} opportunities</strong>
                {stats.wow.content > 0
                  ? `, including ${stats.wow.content} questions customers are already asking.`
                  : "."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/optimize" className="btn-primary">
                  Start Improving My Visibility
                </Link>
                <button
                  type="button"
                  onClick={() => setRevealOpen(false)}
                  className="btn-secondary"
                >
                  Go to dashboard
                </button>
              </div>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border border-slate-200 bg-white p-6 sm:p-8">
              <SectionLabel>AI Visibility</SectionLabel>
              <p className="mt-3 text-sm text-slate-500">
                Your website is becoming more discoverable.
              </p>
              <div className="mt-4 flex items-end gap-4">
                <p className="text-6xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {stats.avgVisibility ?? "—"}
                </p>
                {stats.delta != null && stats.delta !== 0 && (
                  <p
                    className={
                      stats.delta > 0 ? "mb-2 text-sm text-emerald-700" : "mb-2 text-sm text-slate-500"
                    }
                  >
                    {stats.delta > 0 ? "+" : ""}
                    {stats.delta} vs last measured scan
                  </p>
                )}
              </div>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
                {explainVisibility(stats.avgVisibility)}
                {stats.open > 0
                  ? ` ${stats.open} opportunities could improve this score.`
                  : ""}
              </p>
              <p className="mt-4 text-xs text-slate-400">
                Modeled from your crawl — not live queries to ChatGPT or Google.
              </p>
            </div>

            <div className="border border-slate-200 bg-white p-6">
              <SectionLabel>Engines</SectionLabel>
              <div className="mt-5 space-y-3">
                {stats.engines.map((e) => (
                  <EngineBar key={e.name} name={e.name} score={e.score} />
                ))}
              </div>
              {stats.engines.every((e) => e.score == null) && (
                <p className="mt-4 text-sm text-slate-500">
                  Run an AI visibility scan from a site to score each engine.
                </p>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="border border-slate-200 bg-white p-6">
              <SectionLabel>GEO Archer is working for you</SectionLabel>
              <ul className="mt-5 space-y-2.5">
                <WorkRow done={stats.working.technical} label="Technical SEO" />
                <WorkRow done={stats.working.structured} label="Structured Data" />
                <WorkRow done={stats.working.entities} label="Entity Signals" />
                <WorkRow done={stats.working.links} label="Internal Linking" />
                <WorkRow done={stats.working.gaps} label="Content Gaps" />
                <WorkRow done={stats.working.visibility} label="AI Search Visibility" />
                <WorkRow done={stats.working.competitors} label="Competitor Monitoring" />
              </ul>
              <p className="mt-5 text-sm text-slate-700">
                <span className="font-semibold tabular-nums">
                  {stats.completed} of {stats.open + stats.completed}
                </span>{" "}
                optimizations completed
              </p>
              <Link
                href="/seo/opportunities"
                className="mt-4 inline-block text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                Review Optimizations
              </Link>
            </div>

            <div className="border border-slate-200 bg-white p-6">
              <SectionLabel>Optimization opportunities</SectionLabel>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">
                {stats.open}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Found from your latest analysis — framed as work GEO Archer can do.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {stats.buckets.map(([label, count]) => (
                  <li key={label} className="flex justify-between text-slate-600">
                    <span>{label}</span>
                    <span className="tabular-nums font-medium text-slate-900">{count}</span>
                  </li>
                ))}
                {stats.buckets.length === 0 && (
                  <li className="text-slate-400">No open opportunities yet.</li>
                )}
              </ul>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <SectionLabel>High-impact opportunities</SectionLabel>
                <p className="mt-2 text-sm text-slate-500">
                  What we found, why it matters, and what GEO Archer can do.
                </p>
              </div>
              <Link
                href="/optimize"
                className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                See all
              </Link>
            </div>
            <div className="grid gap-4">
              {stats.highImpact.map(({ rec, site, scanId }) => (
                <article
                  key={`${site.siteId}-${rec.title}`}
                  className="border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {rec.title}
                    </h3>
                    <ImpactBadge impact={rec.impact} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {rec.why}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{hostOf(site.url)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {scanId && (
                      <GenerateActionButton
                        scanId={scanId}
                        kind={kindForRecommendation(rec)}
                        topic={rec.title}
                      />
                    )}
                    <Link
                      href={`/sites/${site.siteId}`}
                      className="btn-secondary text-sm"
                    >
                      Improve Visibility
                    </Link>
                  </div>
                </article>
              ))}
              {stats.highImpact.length === 0 && (
                <p className="text-sm text-slate-500">
                  After the next scan, high-impact actions will appear here.
                </p>
              )}
            </div>
          </section>
        </FadeIn>
      )}
    </AppShell>
  );
}
