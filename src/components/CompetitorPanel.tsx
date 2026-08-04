"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CompetitorComparisonResult } from "@/lib/competitor-compare";

function scoreCell(v: number | null): string {
  if (v === null) return "—";
  return String(v);
}

export function CompetitorPanel({
  scanId,
  primarySiteUrl,
}: {
  scanId: string;
  primarySiteUrl: string;
}) {
  const [data, setData] = useState<CompetitorComparisonResult | null>(null);
  const [urlsText, setUrlsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const res = await fetch(`/api/scans/${scanId}/competitors`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Failed to load competitors.");
        }
        const json: CompetitorComparisonResult = await res.json();
        if (cancelled) return;
        setData(json);
        const busy = json.competitors.some(
          (c) =>
            c.status === "QUEUED" ||
            c.status === "CRAWLING" ||
            c.status === "ANALYZING"
        );
        if (busy) timer = setTimeout(load, 2000);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanId]);

  async function addCompetitors(e: React.FormEvent) {
    e.preventDefault();
    const urls = urlsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Failed to add competitors.");
      setUrlsText("");
      setLoading(true);
      const refresh = await fetch(`/api/scans/${scanId}/competitors`, {
        cache: "no-store",
      });
      setData(await refresh.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add.");
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <section className="card p-6 text-slate-500">
        Loading competitor comparison…
      </section>
    );
  }

  if (!data) return null;

  const rows = [data.primary, ...data.competitors];

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Competitor AI visibility</h2>
      <p className="mt-1 text-sm text-slate-500">
        Compare GEO and understanding scores with up to 5 competitors (shorter
        crawl). Spot semantic topics they cover that you don&apos;t.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={addCompetitors} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder="https://competitor1.com&#10;https://competitor2.com"
          rows={2}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || data.competitors.length >= 5}
          className="btn-primary shrink-0 sm:self-start"
        >
          {submitting ? "Starting…" : "Add competitors"}
        </button>
      </form>

      {data.conceptsCompetitorsCoverMore.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <p className="text-sm font-medium text-amber-200/90">
            Concepts competitors emphasize more
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.conceptsCompetitorsCoverMore.map((t) => (
              <span
                key={t}
                className="rounded-full border border-amber-800/50 px-3 py-1 text-xs text-amber-100/90"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Site</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium text-right">GEO</th>
              <th className="py-2 pr-4 font-medium text-right">Understanding</th>
              <th className="py-2 font-medium text-right">AI visibility</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isYou = row.siteUrl === primarySiteUrl;
              return (
                <tr
                  key={row.scanId}
                  className={`border-b border-slate-100 ${
                    isYou ? "bg-sky-50" : ""
                  }`}
                >
                  <td className="py-2 pr-4 max-w-xs truncate">
                    {isYou ? (
                      <span className="font-medium text-sky-700">You · {row.siteUrl}</span>
                    ) : (
                      <Link
                        href={`/scan/${row.scanId}`}
                        className="text-slate-700 hover:text-sky-600"
                      >
                        {row.siteUrl}
                      </Link>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{row.status}</td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {scoreCell(row.geoOverall)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {scoreCell(row.understanding)}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {scoreCell(row.visibilityOverall)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        AI visibility shown when you&apos;ve run visibility scoring on that scan.
        Competitor crawls use fewer pages by default (
        <code className="text-slate-500">COMPETITOR_MAX_CRAWL_PAGES</code>).
      </p>
    </section>
  );
}
