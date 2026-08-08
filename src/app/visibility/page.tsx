"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SiteFilter, filterSitesById } from "@/components/SiteFilter";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { ScoreCard } from "@/components/cards/ScoreCard";
import { useInsights } from "@/lib/useInsights";
import { hostOf, scoreTone } from "@/lib/utils";

export default function VisibilityPage() {
  const { data, error, loading } = useInsights();
  const [siteId, setSiteId] = useState("");

  const sites = useMemo(
    () => filterSitesById(data?.sites ?? [], siteId),
    [data, siteId]
  );
  const scored = sites.filter((s) => s.visibility);
  const avg =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, s) => sum + s.visibility!.overall, 0) /
            scored.length
        )
      : null;

  return (
    <AppShell
      title="AI Visibility"
      subtitle="How likely each AI assistant is to understand and surface your sites."
      actions={
        data && data.sites.length > 1 ? (
          <SiteFilter
            sites={data.sites}
            value={siteId}
            onChange={setSiteId}
          />
        ) : undefined
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-64" />}

      {data && (
        <FadeIn className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ScoreCard
              label={siteId ? "Site AI visibility" : "Portfolio AI visibility"}
              score={avg}
              suffix="%"
              explanation={
                siteId
                  ? "Modeled visibility for the selected site."
                  : "Average modeled visibility across sites that have been scored."
              }
            />
            <ScoreCard
              label="Sites scored"
              score={scored.length}
              explanation={`${sites.length - scored.length} site(s) still need a visibility run — open a site and use the AI Visibility tab.`}
            />
          </div>

          {scored.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="font-medium text-slate-700">
                No visibility scores yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
                Open a site and run visibility scoring from its AI Visibility tab
                to model how ChatGPT, Claude, Gemini, Perplexity, and Copilot see
                it.
              </p>
              <Link href="/sites" className="btn-primary mt-6 inline-block">
                Go to Sites
              </Link>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {scored.map((s) => (
                <Card key={s.siteId} className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/sites/${s.siteId}?tab=visibility`}
                      className="font-semibold text-slate-900 hover:text-sky-600"
                    >
                      {hostOf(s.url)}
                    </Link>
                    <Badge tone={scoreTone(s.visibility!.overall)}>
                      {s.visibility!.overall}% overall
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {s.visibility!.assistants.map((a) => (
                      <div key={a.assistant}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-600">
                            {a.assistant}
                          </span>
                          <span className="font-mono text-slate-500">
                            {a.score}%
                          </span>
                        </div>
                        <Progress value={a.score} className="mt-1" />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}
