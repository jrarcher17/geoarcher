"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  GenerateActionButton,
  kindForRecommendation,
} from "@/components/cards/GenerateAction";
import { cn, estimatedGain, impactTone } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

/**
 * One recommendation, one decision: Impact, Difficulty, Estimated GEO gain,
 * and a one-click CTA. "How" details are collapsed by default.
 */
export function RecommendationCard({
  rec,
  scanId,
  siteLabel,
}: {
  rec: Recommendation;
  scanId?: string;
  siteLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {siteLabel && (
            <p className="mb-1 text-xs font-medium text-slate-400">{siteLabel}</p>
          )}
          <p className="font-semibold text-slate-900">{rec.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{rec.why}</p>
        </div>
        {scanId && (
          <GenerateActionButton
            scanId={scanId}
            kind={kindForRecommendation(rec)}
            topic={rec.title}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={impactTone(rec.impact)}>Impact: {rec.impact}</Badge>
        <Badge tone={rec.effort === "low" ? "positive" : rec.effort === "medium" ? "warning" : "critical"}>
          Difficulty: {rec.effort}
        </Badge>
        <Badge tone="info">Est. GEO gain {estimatedGain(rec.impact)}</Badge>
        <Badge tone="neutral">{rec.category}</Badge>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
      >
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
        {open ? "Hide implementation notes" : "How to implement"}
      </button>
      {open && (
        <p className="mt-2 rounded-none border border-slate-100 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-600">
          {rec.how}
        </p>
      )}
    </Card>
  );
}
