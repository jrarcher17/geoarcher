"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  SeoOpportunityDto,
  SeoOpportunityStatusId,
  SeoOverviewDto,
} from "@/lib/seo/types";
import { useInsights } from "@/lib/useInsights";

const POLL_MS = 4000;

/**
 * Shared state for all SEO Autopilot pages: site selection (?site=), the
 * overview payload, audit start/polling, and opportunity status updates.
 */
export function useSeoAutopilot() {
  const { data: insights, error: insightsError } = useInsights();
  const router = useRouter();
  const searchParams = useSearchParams();

  const sites = useMemo(
    () => (insights?.sites ?? []).map((s) => ({ siteId: s.siteId, url: s.url })),
    [insights]
  );

  const requestedSiteId = searchParams.get("site") ?? "";
  const siteId = useMemo(() => {
    if (requestedSiteId && sites.some((s) => s.siteId === requestedSiteId)) {
      return requestedSiteId;
    }
    return sites[0]?.siteId ?? "";
  }, [requestedSiteId, sites]);

  const setSiteId = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("site", next);
      else params.delete("site");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const [overview, setOverview] = useState<SeoOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [starting, setStarting] = useState(false);
  const startedForScan = useRef<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!siteId) return;
      if (!silent) {
        setOverview(null);
        setError(null);
        setUpgradeRequired(false);
      }
      const res = await fetch(`/api/sites/${siteId}/seo`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.upgradeRequired) setUpgradeRequired(true);
        else setError(json.error ?? "Failed to load SEO Autopilot.");
        return;
      }
      setOverview(json as SeoOverviewDto);
    },
    [siteId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const runAudit = useCallback(async () => {
    if (!siteId || starting) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/seo/audit`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not start the SEO audit.");
        return;
      }
      startedForScan.current = json.scanId ?? null;
      await load(true);
    } finally {
      setStarting(false);
    }
  }, [siteId, starting, load]);

  // Auto-run the first audit when a completed scan exists but no audit does,
  // and poll while an audit is running or freshly started.
  const auditStatus = overview?.audit?.status ?? null;
  const shouldAutoRun = Boolean(
    overview &&
      overview.latestScanId &&
      !overview.audit &&
      startedForScan.current !== overview.latestScanId
  );

  useEffect(() => {
    if (!shouldAutoRun) return;
    startedForScan.current = overview?.latestScanId ?? null;
    void runAudit();
  }, [shouldAutoRun, overview?.latestScanId, runAudit]);

  const polling =
    auditStatus === "RUNNING" ||
    (Boolean(startedForScan.current) &&
      overview?.audit?.scanId !== startedForScan.current);

  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(t);
  }, [polling, load]);

  const updateOpportunityStatus = useCallback(
    async (oppId: string, status: SeoOpportunityStatusId) => {
      if (!siteId) return;
      // Optimistic update
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              opportunities: prev.opportunities.map((o) =>
                o.id === oppId ? { ...o, status } : o
              ),
            }
          : prev
      );
      const res = await fetch(`/api/sites/${siteId}/seo/opportunities/${oppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) await load(true);
    },
    [siteId, load]
  );

  return {
    sites,
    siteId,
    setSiteId,
    plan: insights?.plan ?? null,
    overview,
    error: error ?? insightsError,
    upgradeRequired,
    loading: !overview && !error && !insightsError && !upgradeRequired,
    auditRunning: polling || starting,
    runAudit,
    updateOpportunityStatus,
  };
}

export type { SeoOpportunityDto, SeoOverviewDto };
