"use client";

import { useEffect, useState } from "react";
import type { SimulationState } from "@/lib/types";

function likelihoodColor(score: number): string {
  if (score >= 65) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function LikelihoodBar({
  label,
  score,
  accent,
}: {
  label: string;
  score: number;
  accent: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-xs uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${accent ? "bg-emerald-500" : "bg-slate-300"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`w-10 shrink-0 text-right font-mono text-sm ${likelihoodColor(score)}`}>
        {score}%
      </span>
    </div>
  );
}

export function SimulationPanel({
  scanId,
  simulation,
  onStarted,
}: {
  scanId: string;
  simulation: SimulationState | null;
  onStarted: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [pendingRun, setPendingRun] = useState(false);

  useEffect(() => {
    if (
      simulation?.status === "RUNNING" ||
      simulation?.status === "COMPLETE" ||
      simulation?.status === "FAILED"
    ) {
      setPendingRun(false);
    }
  }, [simulation?.status]);

  async function start() {
    setStarting(true);
    setStartError(null);
    setPendingRun(true);
    try {
      const res = await fetch(`/api/scans/${scanId}/simulation`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start simulation.");
      }
      onStarted();
    } catch (err) {
      setPendingRun(false);
      setStartError(err instanceof Error ? err.message : "Failed to start.");
    } finally {
      setStarting(false);
    }
  }

  const status = pendingRun ? "RUNNING" : simulation?.status;
  const results = status === "COMPLETE" ? simulation?.results ?? null : null;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">AI answer simulation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Would an AI assistant cite you today? And after you implement the
            recommendations? Simulated by GEO Archer&apos;s scoring model.
          </p>
        </div>
        {(!status || status === "FAILED") && (
          <button
            onClick={start}
            disabled={starting}
            className="btn-primary"
          >
            {starting
              ? "Starting…"
              : status === "FAILED"
                ? "Retry simulation"
                : "Run simulation"}
          </button>
        )}
      </div>

      {startError && <p className="mt-3 text-sm text-red-600">{startError}</p>}
      {status === "FAILED" && simulation?.error && (
        <p className="mt-3 text-sm text-red-600">{simulation.error}</p>
      )}

      {status === "RUNNING" && (
        <div className="mt-6 flex items-center gap-3 text-slate-700">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-400" />
          Generating realistic user prompts and scoring citation likelihood…
        </div>
      )}

      {results && (
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-around gap-6 rounded-none border border-slate-200 bg-slate-50 p-5">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Likelihood of citation — today
              </p>
              <p className={`mt-1 text-4xl font-bold ${likelihoodColor(results.overallBefore)}`}>
                {results.overallBefore}%
              </p>
            </div>
            <span className="text-2xl text-slate-500">→</span>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                After recommendations
              </p>
              <p className={`mt-1 text-4xl font-bold ${likelihoodColor(results.overallAfter)}`}>
                {results.overallAfter}%
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {results.prompts.map((p) => (
              <li
                key={p.prompt}
                className="rounded-none border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">“{p.prompt}”</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {p.category}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  <LikelihoodBar label="Now" score={p.before.likelihood} accent={false} />
                  <LikelihoodBar label="After" score={p.after.likelihood} accent />
                </div>
                <p className="mt-2 text-sm text-slate-500">{p.before.reasoning}</p>
                {p.after.likelihood > p.before.likelihood && (
                  <p className="mt-1 text-sm text-emerald-700">
                    {p.after.reasoning}
                    {p.after.keyChanges.length > 0 && (
                      <span className="text-slate-500">
                        {" "}
                        (driven by: {p.after.keyChanges.join(", ")})
                      </span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
