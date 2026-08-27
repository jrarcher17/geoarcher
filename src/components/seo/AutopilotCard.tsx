"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  Play,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, type Tone } from "@/lib/utils";

interface StepResult {
  step: string;
  status: "ok" | "failed" | "skipped";
  detail: string;
}

interface ScanChanges {
  newPages: string[];
  removedPages: string[];
  changedPages: { url: string; what: string }[];
  comparedToScanId: string | null;
}

interface AutopilotRunDto {
  id: string;
  status: "RUNNING" | "COMPLETE" | "FAILED" | "STOPPED";
  steps: StepResult[];
  changes: ScanChanges | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface AutopilotState {
  configured: boolean;
  enabled: boolean;
  workflow: {
    running: boolean;
    paused: boolean;
    currentStep: string | null;
    nextRunAt: string | null;
  };
  runs: AutopilotRunDto[];
}

const RUN_TONE: Record<AutopilotRunDto["status"], Tone> = {
  RUNNING: "info",
  COMPLETE: "positive",
  FAILED: "critical",
  STOPPED: "neutral",
};

function StepIcon({ status }: { status: StepResult["status"] }) {
  if (status === "ok") return <Check className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "failed")
    return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-300" />;
}

export function AutopilotCard({ siteId }: { siteId: string }) {
  const [state, setState] = useState<AutopilotState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sites/${siteId}/autopilot`, {
      cache: "no-store",
    });
    if (res.ok) setState(await res.json());
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live-refresh while a cycle is actively working.
  const working =
    state?.enabled &&
    state.workflow.running &&
    state.workflow.currentStep !== "sleeping" &&
    state.workflow.currentStep !== "paused";
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [working, load]);

  async function toggle() {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/autopilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !state.enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not update Autopilot.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/autopilot/run-now`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not start a run.");
        return;
      }
      setTimeout(() => void load(), 1500);
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              state.enabled ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-400"
            )}
          >
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Continuous Autopilot
            </h2>
            <p className="mt-0.5 max-w-md text-xs text-slate-400">
              Scans, audits, competitor checks and rankings on a durable loop —
              recommendations only, nothing is changed on your site without you.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {state.enabled && state.workflow.running && (
            <button
              type="button"
              onClick={() => void runNow()}
              disabled={busy || Boolean(working)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-600 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Run now
            </button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={state.enabled}
            onClick={() => void toggle()}
            disabled={busy}
            className={cn(
              "relative h-6 w-11 rounded-full transition disabled:opacity-50",
              state.enabled ? "bg-sky-500" : "bg-slate-200"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                state.enabled ? "left-[22px]" : "left-0.5"
              )}
            />
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!state.configured && (
        <p className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Inngest isn&apos;t connected — set INNGEST_EVENT_KEY and
          INNGEST_SIGNING_KEY, then sync /api/inngest in the Inngest dashboard.
        </p>
      )}

      {state.enabled && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {working ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-sky-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {state.workflow.currentStep}
            </span>
          ) : state.workflow.paused ? (
            <span className="font-medium text-amber-600">Paused</span>
          ) : state.workflow.nextRunAt ? (
            <span>
              Next cycle {new Date(state.workflow.nextRunAt).toLocaleString()}
            </span>
          ) : state.workflow.running ? (
            <span>Waiting for the next cycle</span>
          ) : (
            <span>Waiting for the next Inngest cycle</span>
          )}
        </div>
      )}

      {state.runs.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recent cycles
          </p>
          {state.runs.slice(0, 5).map((run) => {
            const open = openRun === run.id;
            const changes = run.changes;
            return (
              <div key={run.id} className="border border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpenRun(open ? null : run.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <Badge tone={RUN_TONE[run.status]}>
                    {run.status.charAt(0) + run.status.slice(1).toLowerCase()}
                  </Badge>
                  <span className="text-slate-600">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                  {changes && changes.comparedToScanId && (
                    <span className="text-xs text-slate-400">
                      {changes.newPages.length} new · {changes.changedPages.length}{" "}
                      changed · {changes.removedPages.length} removed
                    </span>
                  )}
                  <span className="ml-auto text-slate-300">
                    {open ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                </button>
                {open && (
                  <div className="space-y-1.5 border-t border-slate-100 px-3 py-3">
                    {run.steps.map((s) => (
                      <div key={s.step} className="flex items-start gap-2 text-xs">
                        <StepIcon status={s.status} />
                        <span className="font-medium text-slate-700">{s.step}:</span>
                        <span className="text-slate-500">{s.detail}</span>
                      </div>
                    ))}
                    {run.error && (
                      <p className="text-xs text-red-600">{run.error}</p>
                    )}
                    {changes && changes.changedPages.length > 0 && (
                      <div className="pt-1">
                        {changes.changedPages.slice(0, 5).map((c) => (
                          <p key={c.url} className="text-xs text-slate-500">
                            • {c.url} — {c.what}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
