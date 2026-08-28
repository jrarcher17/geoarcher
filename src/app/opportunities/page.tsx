"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SiteFilter } from "@/components/SiteFilter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
import { useInsights } from "@/lib/useInsights";
import { hostOf } from "@/lib/utils";

export default function OpportunitiesPage() {
  const { data, error, loading } = useInsights();
  const [siteId, setSiteId] = useState("");

  const gaps = useMemo(
    () =>
      (data?.sites ?? [])
        .filter((s) => !siteId || s.siteId === siteId)
        .flatMap((s) =>
          (s.analysis?.contentGaps ?? []).map((gap) => ({
            gap,
            siteLabel: hostOf(s.url),
            scanId: data?.scanIds[s.siteId] ?? undefined,
          }))
        ),
    [data, siteId]
  );

  return (
    <AppShell
      title="Content Opportunities"
      subtitle="Give customers the answers AI search is looking for. Prefer a section or FAQ on an existing page before creating a new URL."
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

      {data &&
        (gaps.length === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-400">
            No content gaps identified yet — run a scan to find them.
          </Card>
        ) : (
          <FadeIn className="grid gap-4 md:grid-cols-2">
            {gaps.map(({ gap, siteLabel, scanId }, i) => (
              <OpportunityCard
                key={`${siteLabel}-${i}`}
                question={gap.question}
                whyItMatters={gap.whyItMatters}
                scanId={scanId}
                siteLabel={siteLabel}
              />
            ))}
          </FadeIn>
        ))}
    </AppShell>
  );
}
