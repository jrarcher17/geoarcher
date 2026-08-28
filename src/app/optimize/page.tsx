"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { GenerateActionButton, kindForRecommendation } from "@/components/cards/GenerateAction";
import { EmptyState, ImpactBadge, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/lib/useInsights";
import { hostOf } from "@/lib/utils";

export default function OptimizePage() {
  const { data, error, loading } = useInsights();

  const items = useMemo(() => {
    const sites = data?.sites ?? [];
    const recs = sites.flatMap((s) =>
      (s.analysis?.recommendations ?? []).map((rec) => ({
        kind: "action" as const,
        title: rec.title,
        why: rec.why,
        how: rec.how,
        impact: rec.impact,
        site: s,
        scanId: data?.scanIds[s.siteId] ?? null,
      }))
    );
    const gaps = sites.flatMap((s) =>
      (s.analysis?.contentGaps ?? []).map((gap) => ({
        kind: "gap" as const,
        title: gap.question,
        why: gap.whyItMatters,
        how: "Prefer adding a section or FAQ on an existing page before creating a new URL.",
        impact: "medium" as const,
        site: s,
        scanId: data?.scanIds[s.siteId] ?? null,
      }))
    );
    return [...recs, ...gaps].sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.impact] - rank[b.impact];
    });
  }, [data]);

  const buckets = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of data?.sites ?? []) {
      for (const b of s.opportunityBuckets) {
        map.set(b.label, (map.get(b.label) ?? 0) + b.count);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <AppShell
      title="Optimization Opportunities"
      subtitle="Here is what we found, why it matters, and what GEO Archer can do about it."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-64" />}
      {data && items.length === 0 && (
        <EmptyState
          title="No opportunities yet"
          body="Analyze a website to find visibility gaps GEO Archer can prioritize and fix."
          actionHref="/sites"
          actionLabel="Analyze Website"
        />
      )}
      {data && items.length > 0 && (
        <FadeIn className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {buckets.map(([label, count]) => (
              <div key={label} className="border border-slate-200 bg-white px-4 py-4">
                <p className="text-2xl font-semibold tabular-nums text-slate-900">{count}</p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {items.map((item) => (
              <article
                key={`${item.site.siteId}-${item.title}`}
                className="border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                  <ImpactBadge impact={item.impact} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.why}</p>
                <p className="mt-2 text-sm text-slate-500">{item.how}</p>
                <p className="mt-2 text-xs text-slate-400">{hostOf(item.site.url)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.scanId && item.kind === "action" && (
                    <GenerateActionButton
                      scanId={item.scanId}
                      kind={kindForRecommendation({
                        title: item.title,
                        category: "GEO",
                      })}
                      topic={item.title}
                    />
                  )}
                  {item.kind === "gap" && (
                    <Link href="/seo/content" className="btn-primary text-sm">
                      Create Recommendation
                    </Link>
                  )}
                  <Link href={`/sites/${item.site.siteId}`} className="btn-secondary text-sm">
                    Improve Visibility
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </FadeIn>
      )}
    </AppShell>
  );
}
