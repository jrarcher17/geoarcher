"use client";

import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { useInsights } from "@/lib/useInsights";
import { gradeFor, hostOf, scoreTone } from "@/lib/utils";

export default function CompetitorsPage() {
  const { data, error, loading } = useInsights();

  const analyzed = (data?.sites ?? []).filter((s) => s.analysis);

  return (
    <AppShell
      title="Competitors"
      subtitle="Benchmark each site against up to five rivals — scores, topics they own, and where you lead."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-64" />}

      {data &&
        (analyzed.length === 0 ? (
          <Card className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">
              Nothing to benchmark yet
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Complete a scan first, then add competitors from the site&apos;s
              Competitors tab.
            </p>
          </Card>
        ) : (
          <FadeIn className="grid gap-4 md:grid-cols-2">
            {analyzed.map((s) => (
              <Link key={s.siteId} href={`/sites/${s.siteId}?tab=competitors`}>
                <Card className="group h-full p-5 transition hover:border-sky-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                      {hostOf(s.url)}
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-sky-500" />
                    </p>
                    <Badge tone={scoreTone(s.analysis!.geoOverall)}>
                      GEO {s.analysis!.geoOverall} · {gradeFor(s.analysis!.geoOverall)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Topic: {s.analysis!.topic}
                  </p>
                  <p className="mt-3 text-sm font-medium text-sky-600">
                    Open competitor benchmark →
                  </p>
                </Card>
              </Link>
            ))}
          </FadeIn>
        ))}
    </AppShell>
  );
}
