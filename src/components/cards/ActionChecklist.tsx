"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, estimatedGain, impactTone } from "@/lib/utils";

export interface ChecklistAction {
  id: string;
  title: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  detail?: string;
  cta?: React.ReactNode;
}

/**
 * The prioritized action plan: a short, ordered list the user can
 * check off. Local state only — it's a working list, not a database.
 */
export function ActionChecklist({
  actions,
  title = "This week's action plan",
  description = "Ranked by impact ÷ effort. Work top to bottom.",
}: {
  actions: ChecklistAction[];
  title?: string;
  description?: string;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge tone="info">
          {done.size}/{actions.length} done
        </Badge>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2">
          {actions.map((a, i) => {
            const checked = done.has(a.id);
            return (
              <li
                key={a.id}
                className={cn(
                  "flex items-start gap-3 rounded-none border p-4 transition",
                  checked
                    ? "border-emerald-100 bg-emerald-50/50"
                    : "border-slate-100 bg-slate-50/60 hover:border-slate-200"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  aria-label={checked ? "Mark not done" : "Mark done"}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border transition",
                    checked
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-transparent hover:border-sky-400"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      checked ? "text-slate-400 line-through" : "text-slate-900"
                    )}
                  >
                    {i + 1}. {a.title}
                  </p>
                  {a.detail && !checked && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {a.detail}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={impactTone(a.impact)}>{a.impact} impact</Badge>
                    <Badge tone="neutral">{a.effort} effort</Badge>
                    <Badge tone="info">{estimatedGain(a.impact)}</Badge>
                  </div>
                </div>
                {a.cta && !checked && <div className="shrink-0">{a.cta}</div>}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
