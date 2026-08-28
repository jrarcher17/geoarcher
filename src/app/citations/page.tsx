"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { EmptyState, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/lib/useInsights";
import { hostOf } from "@/lib/utils";

const FILTERS = ["All", "ChatGPT", "Google AI", "Gemini", "Perplexity", "Claude"] as const;

export default function CitationsPage() {
  const { data, error, loading } = useInsights();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows = useMemo(() => {
    const out: {
      engine: string;
      question: string;
      mentioned: boolean;
      source: string;
      date: string;
    }[] = [];
    for (const site of data?.sites ?? []) {
      const vis = site.visibility;
      if (vis) {
        for (const a of vis.assistants) {
          const engine = a.assistant === "Copilot" ? "Google AI" : a.assistant;
          out.push({
            engine,
            question: `How ${engine} is likely to describe ${hostOf(site.url)}`,
            mentioned: a.score >= 50,
            source: site.url,
            date: site.latestScan?.finishedAt ?? site.latestScan?.createdAt ?? "",
          });
        }
      }
      for (const p of site.simulation?.prompts ?? []) {
        out.push({
          engine: "Modeled",
          question: p.prompt,
          mentioned: p.before.likelihood >= 50,
          source: site.url,
          date: site.latestScan?.finishedAt ?? site.latestScan?.createdAt ?? "",
        });
      }
    }
    return out.filter((r) => filter === "All" || r.engine === filter);
  }, [data, filter]);

  return (
    <AppShell
      title="AI Citations"
      subtitle="When modeled assistants are likely to mention or cite your business. These are not live ChatGPT logs."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-64" />}
      {data && (
        <FadeIn className="space-y-6">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Engine filter">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    : "border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                }
              >
                {f}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title="No AI citations tracked yet"
              body="Run your first AI visibility scan to see when modeled assistants mention your business."
              actionHref="/visibility"
              actionLabel="Run AI Scan"
            />
          ) : (
            <div className="space-y-3">
              <SectionLabel>Modeled mentions</SectionLabel>
              {rows.map((row) => (
                <article
                  key={`${row.engine}-${row.question}`}
                  className="border border-slate-200 bg-white p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {row.engine}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    “{row.question}”
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {row.mentioned
                      ? "Likely mentioned in a modeled answer"
                      : "Not likely mentioned today"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Source {row.source}
                    {row.date ? ` · ${new Date(row.date).toLocaleDateString()}` : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}
