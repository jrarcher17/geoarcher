"use client";

import { Suspense, useState } from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { GenerateActionButton } from "@/components/cards/GenerateAction";
import { SeoShell } from "@/components/seo/SeoShell";
import type { SeoContentAction } from "@/lib/seo/types";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { cn, scoreTone, toneText, type Tone } from "@/lib/utils";

const ACTION_META: Record<
  SeoContentAction,
  { label: string; tone: Tone; blurb: string }
> = {
  improve: {
    label: "Improve",
    tone: "info",
    blurb: "Close to good — fix specific weaknesses",
  },
  expand: {
    label: "Expand",
    tone: "positive",
    blurb: "Topic deserves substantially more depth",
  },
  consolidate: {
    label: "Consolidate",
    tone: "warning",
    blurb: "Merge into a stronger page",
  },
  redirect: {
    label: "Redirect",
    tone: "critical",
    blurb: "No standalone reason to exist",
  },
  create: { label: "Create", tone: "positive", blurb: "New page worth building" },
  leave: { label: "Leave alone", tone: "neutral", blurb: "Working as intended" },
};

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function SeoContentInner() {
  const autopilot = useSeoAutopilot();
  const { overview } = autopilot;
  const [actionFilter, setActionFilter] = useState<SeoContentAction | "all">("all");

  const plan = overview?.contentPlan ?? [];
  const scanId = overview?.audit?.scanId;

  const counts = new Map<SeoContentAction, number>();
  for (const e of plan) counts.set(e.action, (counts.get(e.action) ?? 0) + 1);

  const filtered =
    actionFilter === "all" ? plan : plan.filter((e) => e.action === actionFilter);

  return (
    <SeoShell
      title="Content Autopilot"
      subtitle="A verdict for every notable page — improve, expand, consolidate, redirect, or leave alone. Recommendations and drafts only; nothing is changed automatically."
      autopilot={autopilot}
    >
      {overview?.audit && (
        <FadeIn className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActionFilter("all")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                actionFilter === "all"
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              All ({plan.length})
            </button>
            {(Object.keys(ACTION_META) as SeoContentAction[])
              .filter((a) => (counts.get(a) ?? 0) > 0)
              .map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setActionFilter(a)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    actionFilter === a
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  {ACTION_META[a].label} ({counts.get(a)})
                </button>
              ))}
          </div>

          {plan.length === 0 ? (
            <Card className="p-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No content plan yet</p>
              <p className="mt-1 text-sm text-slate-400">
                The content plan is generated when the SEO audit runs — re-run the
                audit if this audit predates Content Autopilot.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((entry) => {
                const meta = ACTION_META[entry.action];
                return (
                  <Card key={entry.url} className="flex flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <span className="text-[11px] text-slate-400">
                            {meta.blurb}
                          </span>
                        </div>
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block truncate font-semibold text-slate-900 hover:text-sky-600"
                        >
                          {pathOf(entry.url)}
                        </a>
                      </div>
                      {entry.currentScore != null && (
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "text-xl font-bold",
                              toneText[scoreTone(entry.currentScore)]
                            )}
                          >
                            {entry.currentScore}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">
                            Current score
                          </p>
                        </div>
                      )}
                    </div>

                    {entry.observations.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                        {entry.observations.map((o, i) => (
                          <li key={i} className="text-xs leading-relaxed text-slate-500">
                            • {o}
                          </li>
                        ))}
                      </ul>
                    )}

                    {entry.improvements.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Recommended improvements
                        </p>
                        <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                          {entry.improvements.map((imp, i) => (
                            <li
                              key={i}
                              className="text-sm leading-relaxed text-slate-600"
                            >
                              {imp}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {scanId && entry.action !== "leave" && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <GenerateActionButton
                          scanId={scanId}
                          kind="brief"
                          topic={`Optimization plan for ${pathOf(entry.url)}: ${entry.improvements.slice(0, 3).join("; ")}`}
                        />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </FadeIn>
      )}
    </SeoShell>
  );
}

export default function SeoContentPage() {
  return (
    <Suspense>
      <SeoContentInner />
    </Suspense>
  );
}
