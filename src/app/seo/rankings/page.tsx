"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  RefreshCw,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoShell } from "@/components/seo/SeoShell";
import type { SeoRankingsDto } from "@/lib/seo/types";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { cn, hostOf } from "@/lib/utils";

function positionTone(pos: number | null): string {
  if (pos == null) return "text-slate-400";
  if (pos <= 3) return "text-emerald-600";
  if (pos <= 10) return "text-sky-600";
  if (pos <= 30) return "text-amber-600";
  return "text-slate-500";
}

function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null || current === previous) {
    return <Minus className="h-3.5 w-3.5 text-slate-300" />;
  }
  const improved = current < previous;
  const diff = Math.abs(previous - current);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        improved ? "text-emerald-600" : "text-red-500"
      )}
    >
      {improved ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {diff}
    </span>
  );
}

function Sparkline({ history }: { history: { position: number | null }[] }) {
  const points = history.filter((h) => h.position != null) as { position: number }[];
  if (points.length < 2) return <span className="text-xs text-slate-300">—</span>;
  const w = 80;
  const h = 24;
  const max = Math.max(...points.map((p) => p.position));
  const min = Math.min(...points.map((p) => p.position));
  const range = Math.max(1, max - min);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      // Lower position = better = higher on the chart.
      const y = ((p.position - min) / range) * (h - 4) + 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="text-sky-500">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function SeoRankingsInner() {
  const autopilot = useSeoAutopilot();
  const { overview, siteId } = autopilot;
  const [data, setData] = useState<SeoRankingsDto | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!siteId) return;
    const res = await fetch(`/api/sites/${siteId}/seo/rankings`, {
      cache: "no-store",
    });
    if (res.ok) setData(await res.json());
  }, [siteId]);

  useEffect(() => {
    if (overview) void load();
  }, [overview, load]);

  async function addKeywords(e: React.FormEvent) {
    e.preventDefault();
    const keywords = input
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/seo/rankings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not add keywords.");
        return;
      }
      setInput("");
      setData(json);
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/seo/rankings/check`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Rank check failed.");
        return;
      }
      await load();
    } finally {
      setChecking(false);
    }
  }

  async function remove(keywordId: string) {
    setData((prev) =>
      prev
        ? { ...prev, keywords: prev.keywords.filter((k) => k.id !== keywordId) }
        : prev
    );
    await fetch(`/api/sites/${siteId}/seo/rankings/${keywordId}`, {
      method: "DELETE",
    });
  }

  const lastChecked = data?.keywords.find((k) => k.lastCheckedAt)?.lastCheckedAt;

  return (
    <SeoShell
      title="Rankings"
      subtitle="Real Google positions for the keywords you track, checked via DataForSEO — no estimates."
      autopilot={autopilot}
    >
      {overview && (
        <FadeIn className="space-y-5">
          {data && !data.configured && (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">DataForSEO isn&apos;t connected yet</p>
              <p className="mt-1">
                Add <code className="rounded bg-amber-100 px-1">DATAFORSEO_LOGIN</code>{" "}
                and{" "}
                <code className="rounded bg-amber-100 px-1">DATAFORSEO_PASSWORD</code>{" "}
                to your environment (credentials from app.dataforseo.com), then
                restart. You can queue keywords now — positions fill in once
                connected.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Card className="p-5">
            <form onSubmit={(e) => void addKeywords(e)} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="keywords to track, comma separated"
                className="input-field flex-1"
              />
              <Button type="submit" disabled={busy || !input.trim()}>
                {busy ? "Adding…" : "Track keywords"}
              </Button>
            </form>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                {data?.keywords.length ?? 0} of {data?.maxKeywords ?? 25} keywords
                tracked. Each check queries live Google results.
              </span>
              {data && data.keywords.length > 0 && data.configured && (
                <button
                  type="button"
                  onClick={() => void checkNow()}
                  disabled={checking}
                  className="inline-flex items-center gap-1.5 font-medium text-sky-600 hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
                  {checking ? "Checking…" : "Check now"}
                  {lastChecked &&
                    !checking &&
                    ` (last: ${new Date(lastChecked).toLocaleString()})`}
                </button>
              )}
            </div>
          </Card>

          {!data ? (
            <Skeleton className="h-64" />
          ) : data.keywords.length === 0 ? (
            <Card className="p-10 text-center">
              <TrendingUp className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No keywords tracked yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Add the queries you care about above — the Search opportunities
                tab is a good source of candidates.
              </p>
            </Card>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Keyword</th>
                    <th className="px-4 py-2.5">Position</th>
                    <th className="px-4 py-2.5">Change</th>
                    <th className="px-4 py-2.5">Trend</th>
                    <th className="px-4 py-2.5">Your page</th>
                    <th className="px-4 py-2.5">#1 result</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {data.keywords.map((k) => {
                    const top = k.topResults[0];
                    return (
                      <tr key={k.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {k.keyword}
                        </td>
                        <td className={cn("px-4 py-3 text-base font-bold", positionTone(k.position))}>
                          {k.position ?? (k.lastCheckedAt ? ">100" : "—")}
                        </td>
                        <td className="px-4 py-3">
                          <Delta current={k.position} previous={k.previousPosition} />
                        </td>
                        <td className="px-4 py-3">
                          <Sparkline history={k.history} />
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-500">
                          {k.url ? (
                            <a
                              href={k.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-sky-600"
                            >
                              {new URL(k.url).pathname}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-500">
                          {top ? hostOf(top.url) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void remove(k.id)}
                            className="text-slate-300 transition hover:text-red-500"
                            aria-label={`Stop tracking ${k.keyword}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </FadeIn>
      )}
    </SeoShell>
  );
}

export default function SeoRankingsPage() {
  return (
    <Suspense>
      <SeoRankingsInner />
    </Suspense>
  );
}
