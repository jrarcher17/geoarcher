"use client";

import { useEffect, useState } from "react";
import type { SiteInsight } from "@/app/api/me/insights/route";

export type { SiteInsight };

import type { PlanId } from "@/lib/plans";

export interface Insights {
  sites: SiteInsight[];
  scanIds: Record<string, string | null>;
  plan: PlanId;
}

/** Shared loader for all aggregate pages (dashboard, visibility, recs, …). */
export function useInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/me/insights", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (!cancelled) setError(j.error ?? "Failed to load.");
        return;
      }
      const json = await res.json();
      if (!cancelled) setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, loading: !data && !error };
}
