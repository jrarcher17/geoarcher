"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FileSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoShell } from "@/components/seo/SeoShell";
import type { SeoPageAuditDto } from "@/lib/seo/types";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { cn, scoreTone, toneText } from "@/lib/utils";

const HEALTH_FILTERS = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "needs-improvement", label: "Needs Improvement" },
  { id: "good", label: "Good" },
  { id: "excellent", label: "Excellent" },
] as const;

type HealthFilter = (typeof HEALTH_FILTERS)[number]["id"];
type SortKey = "score" | "url" | "wordCount" | "issues";

function healthOf(score: number): HealthFilter {
  if (score < 50) return "critical";
  if (score < 75) return "needs-improvement";
  if (score < 90) return "good";
  return "excellent";
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function SeoPagesInner() {
  const autopilot = useSeoAutopilot();
  const { overview, siteId } = autopilot;
  const [pages, setPages] = useState<SeoPageAuditDto[] | null>(null);
  const [filter, setFilter] = useState<HealthFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(true);

  const auditId = overview?.audit?.id ?? null;
  useEffect(() => {
    if (!siteId || !auditId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sites/${siteId}/seo/pages`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled) setPages(json.pages ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, auditId]);

  const filtered = useMemo(() => {
    let list = pages ?? [];
    if (filter !== "all") list = list.filter((p) => healthOf(p.score) === filter);
    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "url":
          return dir * pathOf(a.url).localeCompare(pathOf(b.url));
        case "wordCount":
          return dir * (a.facts.wordCount - b.facts.wordCount);
        case "issues":
          return dir * (a.issues.length - b.issues.length);
        default:
          return dir * (a.score - b.score);
      }
    });
  }, [pages, filter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({
    label,
    sort,
    className,
  }: {
    label: string;
    sort: SortKey;
    className?: string;
  }) => (
    <th className={cn("px-4 py-2.5", className)}>
      <button
        type="button"
        onClick={() => toggleSort(sort)}
        className="inline-flex items-center gap-1 hover:text-slate-700"
      >
        {label}
        {sortKey === sort &&
          (sortAsc ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </th>
  );

  return (
    <SeoShell
      title="Pages"
      subtitle="Page-level SEO audit for every crawled page — sort, filter, and drill into any URL."
      autopilot={autopilot}
    >
      {overview?.audit && (
        <FadeIn className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {HEALTH_FILTERS.map((f) => {
              const count =
                f.id === "all"
                  ? (pages ?? []).length
                  : (pages ?? []).filter((p) => healthOf(p.score) === f.id).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    filter === f.id
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>

          {!pages ? (
            <Skeleton className="h-64" />
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <FileSearch className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">
                No pages match this filter.
              </p>
            </Card>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <SortHeader label="URL" sort="url" />
                    <SortHeader label="Score" sort="score" />
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">H1</th>
                    <th className="px-4 py-2.5">Meta</th>
                    <SortHeader label="Words" sort="wordCount" />
                    <th className="px-4 py-2.5">Links in/out</th>
                    <th className="px-4 py-2.5">Schema</th>
                    <SortHeader label="Issues" sort="issues" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="max-w-[220px] truncate px-4 py-3">
                        <Link
                          href={`/seo/pages/${p.id}?site=${siteId}`}
                          className="font-medium text-sky-600 hover:underline"
                        >
                          {pathOf(p.url)}
                        </Link>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-bold",
                          toneText[scoreTone(p.score)]
                        )}
                      >
                        {p.score}
                      </td>
                      <td className="px-4 py-3">
                        {p.facts.title ? (
                          <span className="text-slate-600">
                            {p.facts.titleLength} ch
                          </span>
                        ) : (
                          <Badge tone="critical">Missing</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.facts.h1Count === 1 ? (
                          <span className="text-emerald-600">✓</span>
                        ) : p.facts.h1Count === 0 ? (
                          <Badge tone="warning">None</Badge>
                        ) : (
                          <Badge tone="warning">{p.facts.h1Count}×</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.facts.metaDescription ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <Badge tone="warning">Missing</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.facts.wordCount}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.facts.incomingInternalLinks} / {p.facts.internalLinksOut}
                      </td>
                      <td className="px-4 py-3">
                        {p.facts.schemaTypes.length > 0 ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.issues.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </FadeIn>
      )}
    </SeoShell>
  );
}

export default function SeoPagesPage() {
  return (
    <Suspense>
      <SeoPagesInner />
    </Suspense>
  );
}
