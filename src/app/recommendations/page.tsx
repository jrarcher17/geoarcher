"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { RecommendationCard } from "@/components/cards/RecommendationCard";
import { useInsights } from "@/lib/useInsights";
import { hostOf } from "@/lib/utils";

const FILTERS = ["all", "high", "medium", "low"] as const;

export default function RecommendationsPage() {
  const { data, error, loading } = useInsights();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const items = useMemo(() => {
    const all = (data?.sites ?? []).flatMap((s) =>
      (s.analysis?.recommendations ?? []).map((rec) => ({
        rec,
        siteLabel: hostOf(s.url),
        scanId: data?.scanIds[s.siteId] ?? undefined,
      }))
    );
    const rank = { high: 0, medium: 1, low: 2 };
    return all
      .filter((i) => filter === "all" || i.rec.impact === filter)
      .sort((a, b) => rank[a.rec.impact] - rank[b.rec.impact]);
  }, [data, filter]);

  return (
    <AppShell
      title="Recommendations"
      subtitle="Every action across your sites, ranked by impact. Each has a one-click draft."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-64" />}

      {data && (
        <FadeIn className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "primary" : "secondary"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : `${f} impact`}
              </Button>
            ))}
          </div>

          {items.length === 0 ? (
            <Card className="p-10 text-center text-sm text-slate-400">
              No recommendations here yet — run a scan first.
            </Card>
          ) : (
            items.map(({ rec, siteLabel, scanId }, i) => (
              <RecommendationCard
                key={`${siteLabel}-${rec.title}-${i}`}
                rec={rec}
                scanId={scanId}
                siteLabel={siteLabel}
              />
            ))
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}
