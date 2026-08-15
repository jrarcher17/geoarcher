"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Plus, Swords, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoShell } from "@/components/seo/SeoShell";
import type { SeoCompetitorComparisonDto } from "@/lib/seo/types";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { cn, hostOf, scoreTone, toneText } from "@/lib/utils";

const TABLE_CATEGORIES = [
  "technical",
  "content",
  "onPage",
  "internalLinking",
  "structuredData",
  "performance",
] as const;

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-300">—</span>;
  return (
    <span className={cn("font-semibold", toneText[scoreTone(score)])}>{score}</span>
  );
}

function SeoCompetitorsInner() {
  const autopilot = useSeoAutopilot();
  const { overview, siteId } = autopilot;
  const [data, setData] = useState<SeoCompetitorComparisonDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!siteId) return;
    const res = await fetch(`/api/sites/${siteId}/seo/competitors`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Failed to load competitor comparison.");
      return;
    }
    setError(null);
    setData(json);
  }, [siteId]);

  useEffect(() => {
    if (overview?.latestScanId) void load();
  }, [overview?.latestScanId, load]);

  // Poll while competitor crawls are in flight.
  const crawling = (data?.competitors ?? []).some(
    (c) => c.status === "QUEUED" || c.status === "CRAWLING" || c.status === "ANALYZING"
  );
  useEffect(() => {
    if (!crawling) return;
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [crawling, load]);

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !url.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/scans/${data.primaryScanId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url.trim()] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not add competitor.");
        return;
      }
      setUrl("");
      setError(null);
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function removeCompetitor(scanId: string) {
    if (!data || removing) return;
    setRemoving(scanId);
    try {
      await fetch(`/api/scans/${data.primaryScanId}/competitors`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorScanId: scanId }),
      });
      await load();
    } finally {
      setRemoving(null);
    }
  }

  const rows = data ? [data.you, ...data.competitors] : [];

  return (
    <SeoShell
      title="SEO Competitors"
      subtitle="Crawl competitor sites with the same engine and compare SEO dimensions side by side. Only publicly accessible pages are analyzed."
      autopilot={autopilot}
    >
      {overview?.audit && (
        <FadeIn className="space-y-5">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Add competitor */}
          {data && data.competitors.length < data.maxCompetitors && (
            <Card className="p-5">
              <form onSubmit={(e) => void addCompetitor(e)} className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="competitor.com"
                  className="input-field flex-1"
                />
                <Button type="submit" disabled={adding || !url.trim()}>
                  <Plus className="h-4 w-4" />
                  {adding ? "Starting…" : "Add competitor"}
                </Button>
              </form>
              <p className="mt-2 text-xs text-slate-400">
                {data.competitors.length} of {data.maxCompetitors} competitor slots
                used. Each competitor crawl counts toward your monthly scans.
              </p>
            </Card>
          )}

          {!data ? (
            <Skeleton className="h-64" />
          ) : data.competitors.length === 0 ? (
            <Card className="p-10 text-center">
              <Swords className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No competitors yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Add a competitor domain above to crawl it and compare SEO health.
              </p>
            </Card>
          ) : (
            <>
              {crawling && (
                <div className="flex items-center gap-3 border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                  Crawling competitor pages — the comparison fills in as scans
                  complete.
                </div>
              )}

              {/* Comparison table */}
              <Card className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Dimension</th>
                      {rows.map((r, i) => (
                        <th key={r.scanId} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={i === 0 ? "text-sky-600" : undefined}>
                              {i === 0 ? "You" : hostOf(r.siteUrl)}
                            </span>
                            {i > 0 && (
                              <button
                                type="button"
                                onClick={() => void removeCompetitor(r.scanId)}
                                disabled={removing === r.scanId}
                                className="text-slate-300 transition hover:text-red-500"
                                aria-label={`Remove ${hostOf(r.siteUrl)}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100 bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        SEO Score
                      </td>
                      {rows.map((r) => (
                        <td key={r.scanId} className="px-4 py-3 text-base">
                          {r.status !== "COMPLETE" ? (
                            <span className="text-xs text-slate-400">
                              {r.status.toLowerCase()}…
                            </span>
                          ) : (
                            <ScoreCell score={r.overallScore} />
                          )}
                        </td>
                      ))}
                    </tr>
                    {TABLE_CATEGORIES.map((catId) => (
                      <tr key={catId} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-600">
                          {rows[0]?.categories.find((c) => c.id === catId)?.label ??
                            catId}
                        </td>
                        {rows.map((r) => (
                          <td key={r.scanId} className="px-4 py-3">
                            <ScoreCell
                              score={
                                r.categories.find((c) => c.id === catId)?.score ??
                                null
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-600">Pages crawled</td>
                      {rows.map((r) => (
                        <td key={r.scanId} className="px-4 py-3 text-slate-600">
                          {r.pagesCrawled}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </Card>

              {/* Competitive gaps */}
              {data.gaps.length > 0 && (
                <div>
                  <h2 className="mb-2 text-lg font-semibold text-slate-900">
                    Competitive gaps
                  </h2>
                  <Card className="divide-y divide-slate-100 p-0">
                    {data.gaps.map((g) => (
                      <div
                        key={g.category}
                        className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm"
                      >
                        <span className="font-medium text-slate-800">
                          {g.category}
                        </span>
                        <span className="text-slate-500">
                          you {g.you} vs {hostOf(g.competitorUrl)}{" "}
                          <span className="font-semibold text-slate-700">
                            {g.competitor}
                          </span>
                        </span>
                        <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          −{g.competitor - g.you} pts
                        </span>
                      </div>
                    ))}
                  </Card>
                  <p className="mt-2 text-xs text-slate-400">
                    Gaps are computed from the same deterministic checks run on
                    both sites' crawled pages — observed data, not estimates.
                  </p>
                </div>
              )}
            </>
          )}
        </FadeIn>
      )}
    </SeoShell>
  );
}

export default function SeoCompetitorsPage() {
  return (
    <Suspense>
      <SeoCompetitorsInner />
    </Suspense>
  );
}
