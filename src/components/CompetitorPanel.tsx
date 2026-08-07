"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CompetitorComparisonCard } from "@/components/cards/CompetitorComparisonCard";
import type { CompetitorComparisonResult } from "@/lib/competitor-compare";

function planFootnote(plan: CompetitorComparisonResult["plan"]): string {
  const pages = plan.competitorMaxPages.toLocaleString();
  if (plan.id === "pro") {
    return `Your Pro plan crawls up to ${pages} pages per competitor (up to ${plan.maxCompetitors} rivals per scan).`;
  }
  return `Your Free plan crawls up to ${pages} pages per competitor. Upgrade to Pro in Settings → Billing for deeper coverage.`;
}

export function CompetitorPanel({ scanId }: { scanId: string }) {
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

      <form onSubmit={addCompetitors} className="mt-4 flex flex-col gap-3 sm:flex-row">
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
              <Link
                href={`/scan/${row.scanId}`}
                className="self-end text-xs font-medium text-sky-600 hover:underline"
              >
                Full competitor breakdown →
              </Link>
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
