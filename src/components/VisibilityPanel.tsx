"use client";

import { useState } from "react";
import type { VisibilityState } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

const assistantLabels: Record<string, string> = {
  ChatGPT: "ChatGPT",
  Claude: "Claude",
  Gemini: "Gemini",
  Perplexity: "Perplexity",
  Copilot: "Copilot",
};

export function VisibilityPanel({
  scanId,
  visibility,
  geoOverall,
  onStarted,
}: {
  scanId: string;
  visibility: VisibilityState | null;
  geoOverall: number | null;
  onStarted: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/visibility`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start visibility scoring.");
      }
      onStarted();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start.");
    } finally {
      setStarting(false);
    }
  }

  const results = visibility?.status === "COMPLETE" ? visibility.results : null;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">AI visibility</h2>
          <p className="mt-1 text-sm text-slate-500">
            GeoArcher&apos;s model of how well each assistant would understand and
            surface this site — not live rankings inside those products.
          </p>
        </div>
        {(!visibility || visibility.status === "FAILED") && (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="btn-primary"
          >
            {starting
              ? "Starting…"
              : visibility?.status === "FAILED"
                ? "Retry"
                : "Score AI visibility"}
          </button>
        )}
      </div>

      {startError && <p className="mt-3 text-sm text-red-600">{startError}</p>}
      {visibility?.status === "FAILED" && (
        <p className="mt-3 text-sm text-red-600">{visibility.error}</p>
      )}

      {visibility?.status === "RUNNING" && (
        <div className="mt-6 flex items-center gap-3 text-slate-700">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-400" />
          Scoring ChatGPT, Claude, Gemini, Perplexity, and Copilot…
        </div>
      )}

      {results && (
        <div className="mt-6">
          <div className="flex flex-wrap items-end gap-6 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                AI visibility
              </p>
              <p className={`text-5xl font-bold ${scoreColor(results.overall)}`}>
                {results.overall}%
              </p>
            </div>
            {geoOverall != null && results.overall !== geoOverall && (
              <p className="text-sm text-slate-500">
                GEO score for this scan:{" "}
                <span className="font-mono text-slate-700">{geoOverall}</span>
              </p>
            )}
          </div>

          <ul className="mt-4 flex flex-col gap-3">
            {results.assistants.map((a) => (
              <li key={a.assistant}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {assistantLabels[a.assistant] ?? a.assistant}
                  </span>
                  <span className={`font-mono ${scoreColor(a.score)}`}>
                    {a.score}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500/80"
                    style={{ width: `${a.score}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">{a.reasoning}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
