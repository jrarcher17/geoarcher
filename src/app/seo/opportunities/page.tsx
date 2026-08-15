"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Rocket, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoOpportunityCard } from "@/components/seo/SeoOpportunityCard";
import { SeoShell } from "@/components/seo/SeoShell";
import {
  SEO_OPPORTUNITY_STATUSES,
  type SeoOpportunityStatusId,
  type SeoSearchOpportunityDto,
} from "@/lib/seo/types";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { cn, scoreTone, toneText, type Tone } from "@/lib/utils";

const STATUS_FILTERS = [
  { id: "OPEN", label: "Open" },
  ...SEO_OPPORTUNITY_STATUSES.map((s) => ({
    id: s,
    label: s.charAt(0) + s.slice(1).toLowerCase().replace("_", " "),
  })),
  { id: "ALL", label: "All" },
];

const levelTone: Record<string, Tone> = {
  high: "positive",
  medium: "info",
  low: "neutral",
};

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function SearchOpportunities({
  siteId,
  auditId,
}: {
  siteId: string;
  auditId: string | null;
}) {
  const [opps, setOpps] = useState<SeoSearchOpportunityDto[] | null>(null);

  useEffect(() => {
    if (!siteId || !auditId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sites/${siteId}/seo/search`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled) setOpps(json.opportunities ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, auditId]);

  async function setStatus(id: string, status: SeoOpportunityStatusId) {
    setOpps((prev) =>
      prev ? prev.map((o) => (o.id === id ? { ...o, status } : o)) : prev
    );
    await fetch(`/api/sites/${siteId}/seo/search/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  if (!opps) return <Skeleton className="h-64" />;
  if (opps.length === 0) {
    return (
      <Card className="p-10 text-center">
        <Search className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 font-medium text-slate-700">
          No search opportunities yet
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Search topics are generated when the SEO audit runs — re-run the audit
          if this audit predates the search engine.
        </p>
      </Card>
    );
  }

  return (
    <>
      <p className="text-xs text-slate-400">
        Demand and competition are qualitative AI judgments — GEO Archer has no
        search-volume data and never invents numbers.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {opps.map((o) => (
          <Card
            key={o.id}
            className={cn(
              "p-5",
              (o.status === "DISMISSED" || o.status === "COMPLETED") && "opacity-60"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{o.intent}</Badge>
                  {o.contentType && <Badge tone="neutral">{o.contentType}</Badge>}
                  <Badge tone={levelTone[o.demand] ?? "neutral"}>
                    demand {o.demand}
                  </Badge>
                  <Badge tone={levelTone[o.competition] ?? "neutral"}>
                    competition {o.competition}
                  </Badge>
                </div>
                <h3 className="mt-2 font-semibold text-slate-900">
                  &ldquo;{o.keyword}&rdquo;
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {o.reason}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "text-2xl font-bold",
                    toneText[scoreTone(o.opportunityScore)]
                  )}
                >
                  {o.opportunityScore}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Archer Opportunity Score
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>
                <span className="font-semibold text-slate-600">Current page: </span>
                {o.existingUrl ? pathOf(o.existingUrl) : "none — new content"}
              </p>
              <p>
                <span className="font-semibold text-slate-600">Recommended: </span>
                {o.recommendedUrl}
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                Status
                <select
                  value={o.status}
                  onChange={(e) =>
                    void setStatus(o.id, e.target.value as SeoOpportunityStatusId)
                  }
                  className="rounded-none border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
                >
                  {SEO_OPPORTUNITY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function SeoOpportunitiesInner() {
  const autopilot = useSeoAutopilot();
  const { overview, siteId } = autopilot;
  const [view, setView] = useState<"site" | "search">("site");
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [categoryFilter, setCategoryFilter] = useState("");

  const all = overview?.opportunities ?? [];
  const categories = useMemo(
    () => [...new Set(all.map((o) => o.category))].sort(),
    [all]
  );

  const filtered = all.filter((o) => {
    if (statusFilter === "OPEN" && (o.status === "DISMISSED" || o.status === "COMPLETED"))
      return false;
    if (statusFilter !== "OPEN" && statusFilter !== "ALL" && o.status !== statusFilter)
      return false;
    if (categoryFilter && o.category !== categoryFilter) return false;
    return true;
  });

  return (
    <SeoShell
      title="Opportunities"
      subtitle="Prioritized growth opportunities scored by the Archer Opportunity Score — grounded in what the crawl observed, never invented metrics."
      autopilot={autopilot}
    >
      {overview && (
        <FadeIn className="space-y-4">
          <div className="flex items-center gap-1 border-b border-slate-200">
            {(
              [
                { id: "site", label: "Site opportunities" },
                { id: "search", label: "Search opportunities" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition",
                  view === t.id
                    ? "border-sky-500 text-sky-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {view === "search" ? (
            <SearchOpportunities
              siteId={siteId}
              auditId={overview.audit?.id ?? null}
            />
          ) : (
            <>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  statusFilter === f.id
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                {f.label}
              </button>
            ))}
            {categories.length > 1 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="ml-auto rounded-none border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_", " ")}
                  </option>
                ))}
              </select>
            )}
          </div>

          {filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <Rocket className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">
                No opportunities match this filter
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Opportunities are generated when the SEO audit runs.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((opp) => (
                <SeoOpportunityCard
                  key={opp.id}
                  opp={opp}
                  onStatusChange={(status) =>
                    void autopilot.updateOpportunityStatus(opp.id, status)
                  }
                />
              ))}
            </div>
          )}
            </>
          )}
        </FadeIn>
      )}
    </SeoShell>
  );
}

export default function SeoOpportunitiesPage() {
  return (
    <Suspense>
      <SeoOpportunitiesInner />
    </Suspense>
  );
}
