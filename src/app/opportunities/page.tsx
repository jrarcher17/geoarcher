"use client";

import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
import { useInsights } from "@/lib/useInsights";
import { hostOf } from "@/lib/utils";

export default function OpportunitiesPage() {
  const { data, error, loading } = useInsights();

  const gaps = (data?.sites ?? []).flatMap((s) =>
    (s.analysis?.contentGaps ?? []).map((gap) => ({
      gap,
      siteLabel: hostOf(s.url),
      scanId: data?.scanIds[s.siteId] ?? undefined,
    }))
  );

  return (
    <AppShell
      title="Content Opportunities"
      subtitle="Questions people ask AI assistants that your sites can't answer today. Each is a page or FAQ waiting to exist."
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
