"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { EmptyState, EngineBar, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/lib/useInsights";
import { hostOf } from "@/lib/utils";

export default function AiSearchPage() {
  const { data, error, loading } = useInsights();

  const rows = useMemo(() => {
    return (data?.sites ?? []).flatMap((site) => {
      const prompts = site.simulation?.prompts ?? [];
      return prompts.map((p) => ({
        site,
        prompt: p.prompt,
        likelihood: p.before.likelihood,
        after: p.after.likelihood,
        reasoning: p.before.reasoning,
      }));
    });
  }, [data]);

  const engines = useMemo(() => {
    const scored = (data?.sites ?? []).filter((s) => s.visibility);
    const names = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot"] as const;
    return names.map((name) => {
      const vals = scored
        .map((s) => s.visibility!.assistants.find((a) => a.assistant === name)?.score)
        .filter((n): n is number => n != null);
      const score = vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : null;
      return { name, score };
    });
  }, [data]);

  return (
    <AppShell
      title="AI Search"
      subtitle="Questions AI systems are likely to answer about your industry — modeled from your crawl."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-64" />}
      {data && rows.length === 0 && (
        <EmptyState
          title="No AI search tests yet"
          body="Open a site and run the citation simulation to see questions AI systems would answer — and whether you are likely to be mentioned."
          actionHref="/sites"
          actionLabel="Run AI Search Test"
        />
      )}
      {data && rows.length > 0 && (
        <FadeIn className="space-y-8">
          <section className="border border-slate-200 bg-white p-6">
            <SectionLabel>Modeled engine visibility</SectionLabel>
            <div className="mt-5 space-y-3">
              {engines.map((e) => (
                <EngineBar key={e.name} name={e.name} score={e.score} />
              ))}
            </div>
          </section>
          <section className="space-y-3">
            <SectionLabel>Questions AI systems are answering</SectionLabel>
            {rows.map((row) => (
              <article
                key={`${row.site.siteId}-${row.prompt}`}
                className="border border-slate-200 bg-white p-5"
              >
                <p className="text-sm font-medium text-slate-900">{row.prompt}</p>
                <p className="mt-2 text-sm text-slate-500">{row.reasoning}</p>
                <p className="mt-3 text-xs text-slate-400">
                  {hostOf(row.site.url)} · mention likelihood {row.likelihood}% now
                  {row.after !== row.likelihood
                    ? `, ${row.after}% after recommended changes`
                    : ""}
                </p>
                <Link
                  href={`/sites/${row.site.siteId}`}
                  className="mt-3 inline-block text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  Analyze
                </Link>
              </article>
            ))}
          </section>
        </FadeIn>
      )}
    </AppShell>
  );
}
