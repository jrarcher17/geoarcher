"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScanComparison, ScanHistoryEntry } from "@/lib/types";

function deltaLabel(delta: number | null): string | null {
  if (delta === null || delta === 0) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

function deltaClass(delta: number | null): string {
  if (delta === null || delta === 0) return "text-slate-500";
  return delta > 0 ? "text-emerald-600" : "text-red-600";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TrendSparkline({
  entries,
  field,
}: {
  entries: ScanHistoryEntry[];
  field: "understanding" | "geoOverall";
}) {
  const points = [...entries]
    .reverse()
    .map((e) => e[field])
    .filter((v): v is number => v !== null);
  if (points.length < 2) return null;

  const w = 120;
  const h = 36;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 100);
  const range = max - min || 1;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-28 text-emerald-500">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={coords.join(" ")}
      />
    </svg>
  );
}

export function ContinuousLearningPanel({
  scanId,
  history,
  comparison,
}: {
  scanId: string;
  history: ScanHistoryEntry[] | null;
  comparison: ScanComparison | null;
}) {
  const router = useRouter();
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

  const completed = history?.filter((e) => e.status === "COMPLETE") ?? [];
  const hasMultiple = (history?.length ?? 0) > 1;

  async function rescan() {
    setRescanning(true);
    setRescanError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/rescan`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data.scanId) {
          router.push(`/scan/${data.scanId}`);
          return;
        }
        throw new Error(data.error ?? "Failed to start rescan.");
      }
      router.push(`/scan/${data.scanId}`);
    } catch (err) {
      setRescanError(err instanceof Error ? err.message : "Failed to rescan.");
      setRescanning(false);
    }
  }

  if (!hasMultiple && !comparison) {
    return (
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Continuous learning</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recrawl over time to track AI Understanding and GEO score trends.
              Run another scan after you ship changes.
            </p>
          </div>
          <button
            onClick={rescan}
            disabled={rescanning}
            className="btn-secondary border-sky-200 text-sky-700 hover:bg-sky-50"
          >
            {rescanning ? "Starting…" : "Recrawl site"}
          </button>
        </div>
        {rescanError && <p className="mt-3 text-sm text-red-600">{rescanError}</p>}
      </section>
    );
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Continuous learning</h2>
          <p className="mt-1 text-sm text-slate-500">
            Compare this scan to previous crawls. Scores are GeoArcher&apos;s model
            over time — not live AI rankings.
          </p>
        </div>
        <button
          onClick={rescan}
          disabled={rescanning}
          className="btn-secondary border-sky-200 text-sky-700 hover:bg-sky-50"
        >
          {rescanning ? "Starting…" : "Recrawl site"}
        </button>
      </div>
      {rescanError && <p className="mt-3 text-sm text-red-600">{rescanError}</p>}

      {completed.length >= 2 && history && (
        <div className="mt-6 flex flex-wrap gap-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              AI Understanding trend
            </p>
            <TrendSparkline entries={completed} field="understanding" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              GEO Score trend
            </p>
            <TrendSparkline entries={completed} field="geoOverall" />
          </div>
        </div>
      )}

      {comparison && (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-sm text-slate-500">
            vs previous scan
            {comparison.baselineFinishedAt
              ? ` (${formatDate(comparison.baselineFinishedAt)})`
              : ""}
          </p>
          {comparison.highlights.length > 0 && (
            <ul className="flex flex-col gap-2">
              {comparison.highlights.map((h) => (
                <li
                  key={h}
                  className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-2 text-sm text-sky-800"
                >
                  {h}
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {(
              [
                ["GEO Score", comparison.scoreDeltas.geoOverall],
                ["AI Understanding", comparison.scoreDeltas.understanding],
                ["Citation (after fixes)", comparison.scoreDeltas.simulationAfter],
              ] as const
            ).map(([label, delta]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-slate-400">{label}</p>
                <p className={`mt-1 font-mono text-lg ${deltaClass(delta)}`}>
                  {deltaLabel(delta) ?? "—"}
                </p>
              </div>
            ))}
          </div>

          {comparison.geoComponentDeltas.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700">
                Biggest GEO component moves
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-500">
                {comparison.geoComponentDeltas.slice(0, 5).map((c) => (
                  <li key={c.name}>
                    {c.name}: {c.before} → {c.after}{" "}
                    <span className={deltaClass(c.delta)}>
                      ({deltaLabel(c.delta)})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comparison.resolvedGapQuestions.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700">
                Gaps no longer flagged
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-500">
                {comparison.resolvedGapQuestions.slice(0, 5).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {comparison.newGaps.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700">New gaps</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-500">
                {comparison.newGaps.slice(0, 5).map((g) => (
                  <li key={g.question}>{g.question}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-slate-700">Scan history</p>
          <ul className="mt-2 flex flex-col gap-2">
            {history.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/scan/${e.id}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition hover:border-slate-300 ${
                    e.id === scanId
                      ? "border-sky-200 bg-sky-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <span>{formatDate(e.createdAt)}</span>
                  <span className="text-slate-400">{e.status}</span>
                  <span className="font-mono text-slate-500">
                    {e.understanding != null ? `U ${e.understanding}` : "—"}
                    {e.geoOverall != null ? ` · GEO ${e.geoOverall}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
