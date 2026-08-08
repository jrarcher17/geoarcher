"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { CompetitorComparisonCard } from "@/components/cards/CompetitorComparisonCard";
import type { CompetitorComparisonResult } from "@/lib/competitor-compare";
import { hostOf } from "@/lib/utils";

function planFootnote(plan: CompetitorComparisonResult["plan"]): string {
  const pages = plan.competitorMaxPages.toLocaleString();
  if (plan.id === "pro") {
    return `Your Pro plan crawls up to ${pages} pages per competitor (up to ${plan.maxCompetitors} rivals per scan).`;
  }
  return `Your Free plan crawls up to ${pages} pages per competitor. Upgrade to Pro in Settings → Billing for deeper coverage.`;
}

function competitorsBusy(data: CompetitorComparisonResult | null): boolean {
  return Boolean(
    data?.competitors.some((c) =>
      ["QUEUED", "CRAWLING", "ANALYZING"].includes(c.status)
    )
  );
}

export function CompetitorPanel({ scanId }: { scanId: string }) {
  const [data, setData] = useState<CompetitorComparisonResult | null>(null);
  const [urlsText, setUrlsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/scans/${scanId}/competitors`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Failed to load competitors.");
    }
    const json: CompetitorComparisonResult = await res.json();
    setData(json);
    setError(null);
    return json;
  }, [scanId]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Keep polling while any competitor scan is still running.
  const busy = competitorsBusy(data);
  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          if (cancelled) return;
          await load();
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to refresh.");
          }
        }
      })();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [busy, load]);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCompetitor(competitorScanId: string, siteUrl: string) {
    if (
      !confirm(
        `Remove ${hostOf(siteUrl)} from this comparison? Their crawl data for this benchmark will be deleted.`
      )
    ) {
      return;
    }
    setDeletingId(competitorScanId);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/competitors`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorScanId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not remove competitor.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    } finally {
      setDeletingId(null);
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

  const maxCompetitors = data.plan?.maxCompetitors ?? 5;
  const competitorMaxPages =
    data.plan?.competitorMaxPages?.toLocaleString() ?? "8";

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Competitor AI visibility</h2>
      <p className="mt-1 text-sm text-slate-500">
        Compare GEO and understanding scores with up to {maxCompetitors}{" "}
        competitors ({competitorMaxPages} pages per competitor on your{" "}
        {data.plan?.label ?? "Free"} plan). Spot semantic topics they cover that
        you don&apos;t.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <form
        onSubmit={addCompetitors}
        className="mt-4 flex flex-col gap-3 sm:flex-row"
      >
        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder="https://competitor1.com&#10;https://competitor2.com"
          rows={2}
          className="input-field flex-1 bg-slate-50 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={submitting || data.competitors.length >= maxCompetitors}
          className="btn-primary shrink-0 sm:self-start"
        >
          {submitting ? "Starting…" : "Add competitors"}
        </button>
      </form>

      {busy && (
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
          Analyzing competitors — results will appear when each crawl finishes…
        </div>
      )}

      {data.conceptsCompetitorsCoverMore.length > 0 && (
        <div className="mt-4 rounded-none border border-amber-200/70 bg-amber-50/70 p-4">
          <p className="text-sm font-medium text-amber-800">
            Concepts competitors emphasize more than you
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.conceptsCompetitorsCoverMore.map((t) => (
              <span
                key={t}
                className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs text-amber-800"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.competitors.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data.competitors.map((row) => (
            <div key={row.scanId} className="flex flex-col gap-1.5">
              <CompetitorComparisonCard you={data.primary} competitor={row} />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={deletingId === row.scanId}
                  onClick={() => void removeCompetitor(row.scanId, row.siteUrl)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === row.scanId ? "Removing…" : "Remove"}
                </button>
                <Link
                  href={`/scan/${row.scanId}`}
                  className="text-xs font-medium text-sky-600 hover:underline"
                >
                  Full competitor breakdown →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.plan && (
        <p className="mt-4 text-xs text-slate-400">{planFootnote(data.plan)}</p>
      )}
    </section>
  );
}
