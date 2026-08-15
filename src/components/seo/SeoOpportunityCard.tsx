"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { SeoOpportunityDto, SeoOpportunityStatusId } from "@/lib/seo/types";
import { SEO_OPPORTUNITY_STATUSES } from "@/lib/seo/types";
import { cn, hostOf, scoreTone, toneText } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  CONTENT: "Content",
  ON_PAGE: "On-Page",
  INTERNAL_LINK: "Internal Links",
  SCHEMA: "Schema",
  PERFORMANCE: "Performance",
  SEARCH: "Search",
  COMPETITOR: "Competitor",
  GEO: "GEO",
  NEW_TOOL: "New Tool",
  INDEXING: "Indexing",
};

const STATUS_LABELS: Record<SeoOpportunityStatusId, string> = {
  NEW: "New",
  REVIEWED: "Reviewed",
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DISMISSED: "Dismissed",
};

export function SeoOpportunityCard({
  opp,
  onStatusChange,
}: {
  opp: SeoOpportunityDto;
  onStatusChange: (status: SeoOpportunityStatusId) => void;
}) {
  const dimmed = opp.status === "DISMISSED" || opp.status === "COMPLETED";
  return (
    <Card className={cn("p-5", dimmed && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{CATEGORY_LABELS[opp.category] ?? opp.category}</Badge>
            {opp.contentType && <Badge tone="neutral">{opp.contentType}</Badge>}
            {opp.impact === "high" && <Badge tone="positive">High impact</Badge>}
            {opp.source === "AI" && <Badge tone="neutral">AI-generated</Badge>}
          </div>
          <h3 className="mt-2 font-semibold text-slate-900">{opp.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {opp.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-2xl font-bold tracking-tight",
              toneText[scoreTone(opp.opportunityScore)]
            )}
          >
            {opp.opportunityScore}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Archer Opportunity Score
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs leading-relaxed">
        <p className="text-slate-600">
          <span className="font-semibold text-slate-700">Observed: </span>
          {opp.observed}
        </p>
        <p className="text-slate-500">
          <span className="font-semibold text-slate-600">Inferred: </span>
          {opp.inferred}
        </p>
      </div>

      {opp.affectedPages.length > 0 && (
        <p className="mt-2 truncate text-xs text-slate-400">
          Affects {opp.affectedPages.length} page
          {opp.affectedPages.length === 1 ? "" : "s"}:{" "}
          {opp.affectedPages
            .slice(0, 3)
            .map((u) => {
              try {
                return new URL(u).pathname || "/";
              } catch {
                return hostOf(u);
              }
            })
            .join(", ")}
          {opp.affectedPages.length > 3 && ` +${opp.affectedPages.length - 3} more`}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            Impact <span className="font-semibold capitalize">{opp.impact}</span>
          </span>
          <span>
            Difficulty{" "}
            <span className="font-semibold capitalize">{opp.difficulty}</span>
          </span>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-500">
          Status
          <select
            value={opp.status}
            onChange={(e) => onStatusChange(e.target.value as SeoOpportunityStatusId)}
            className="rounded-none border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
          >
            {SEO_OPPORTUNITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Card>
  );
}
