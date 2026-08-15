"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Link2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoShell } from "@/components/seo/SeoShell";
import type { SeoLinkSuggestionDto, SeoOpportunityStatusId } from "@/lib/seo/types";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { cn, scoreTone, toneText } from "@/lib/utils";

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function SeoInternalLinksInner() {
  const autopilot = useSeoAutopilot();
  const { overview, siteId } = autopilot;
  const [suggestions, setSuggestions] = useState<SeoLinkSuggestionDto[] | null>(null);
  const [showHandled, setShowHandled] = useState(false);

  const auditId = overview?.audit?.id ?? null;
  useEffect(() => {
    if (!siteId || !auditId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sites/${siteId}/seo/internal-links`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled) setSuggestions(json.suggestions ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, auditId]);

  const setStatus = useCallback(
    async (id: string, status: SeoOpportunityStatusId) => {
      setSuggestions((prev) =>
        prev ? prev.map((s) => (s.id === id ? { ...s, status } : s)) : prev
      );
      await fetch(`/api/sites/${siteId}/seo/internal-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    [siteId]
  );

  const open = (suggestions ?? []).filter(
    (s) => s.status === "NEW" || s.status === "REVIEWED"
  );
  const handled = (suggestions ?? []).filter(
    (s) => s.status !== "NEW" && s.status !== "REVIEWED"
  );
  const visible = showHandled ? handled : open;

  return (
    <SeoShell
      title="Internal Links"
      subtitle="Contextual linking opportunities from your crawl graph — approve the ones you want to implement. Nothing is changed on your site automatically."
      autopilot={autopilot}
    >
      {overview?.audit && (
        <FadeIn className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHandled(false)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                !showHandled
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              Open ({open.length})
            </button>
            <button
              type="button"
              onClick={() => setShowHandled(true)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                showHandled
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              Handled ({handled.length})
            </button>
          </div>

          {!suggestions ? (
            <Skeleton className="h-64" />
          ) : visible.length === 0 ? (
            <Card className="p-10 text-center">
              <Link2 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">
                {showHandled
                  ? "No handled suggestions yet"
                  : "No open link suggestions"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Suggestions are generated when the SEO audit runs — re-run the
                audit if this audit predates Internal Links.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {visible.map((s) => (
                <Card key={s.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                        <span className="truncate">{pathOf(s.fromUrl)}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-sky-500" />
                        <span className="truncate">{pathOf(s.toUrl)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Suggested anchor:{" "}
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700">
                          &ldquo;{s.anchor}&rdquo;
                        </span>
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        {s.reason}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-xl font-bold",
                          toneText[scoreTone(s.relevance)]
                        )}
                      >
                        {s.relevance}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Relevance
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    {showHandled ? (
                      <>
                        <Badge
                          tone={s.status === "DISMISSED" ? "neutral" : "positive"}
                        >
                          {s.status.charAt(0) +
                            s.status.slice(1).toLowerCase().replace("_", " ")}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => void setStatus(s.id, "NEW")}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Reopen
                        </button>
                        {s.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => void setStatus(s.id, "COMPLETED")}
                            className="text-xs text-sky-600 hover:underline"
                          >
                            Mark implemented
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void setStatus(s.id, "APPROVED")}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStatus(s.id, "DISMISSED")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300"
                        >
                          <X className="h-3.5 w-3.5" />
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </FadeIn>
      )}
    </SeoShell>
  );
}

export default function SeoInternalLinksPage() {
  return (
    <Suspense>
      <SeoInternalLinksInner />
    </Suspense>
  );
}
