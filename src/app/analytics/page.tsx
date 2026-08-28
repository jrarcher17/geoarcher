"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { KpiCard } from "@/components/ads/primitives";
import { SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatRoas,
} from "@/lib/advertising/format";

interface CommandCenterKpis {
  kpis: {
    activeCampaigns: number;
    totalCampaigns: number;
    spendCents: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpaCents: number | null;
    roas: number | null;
  };
  connections: {
    google: { connected: boolean };
    meta: { connected: boolean };
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<CommandCenterKpis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/command-center", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load.");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = data?.kpis;
  const hasData = (kpis?.spendCents ?? 0) > 0 || (kpis?.impressions ?? 0) > 0;
  const anyConnected =
    data?.connections.google.connected || data?.connections.meta.connected;
  const ctr =
    kpis && kpis.impressions > 0 ? kpis.clicks / kpis.impressions : null;

  return (
    <AppShell
      title="Analytics"
      subtitle="Advertising performance across every platform — last 30 days."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {data && kpis && (
        <FadeIn className="flex flex-col gap-8">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Spend" value={formatMoney(hasData ? kpis.spendCents : null)} />
            <KpiCard
              label="Impressions"
              value={hasData ? formatCount(kpis.impressions) : "—"}
            />
            <KpiCard label="Clicks" value={hasData ? formatCount(kpis.clicks) : "—"} />
            <KpiCard label="CTR" value={formatPercent(ctr)} />
            <KpiCard
              label="Conversions"
              value={hasData ? formatCount(kpis.conversions) : "—"}
            />
            <KpiCard label="CPA" value={formatMoney(kpis.cpaCents)} />
            <KpiCard
              label="Revenue"
              value={
                kpis.roas != null
                  ? formatMoney(Math.round(kpis.spendCents * kpis.roas))
                  : "—"
              }
            />
            <KpiCard label="ROAS" value={formatRoas(kpis.roas)} />
          </section>

          {!hasData && (
            <section className="border border-dashed border-slate-300 bg-white px-6 py-10">
              <SectionLabel>No performance data yet</SectionLabel>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Analytics light up when campaigns run
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                {anyConnected
                  ? "Your ad account is connected. Publish a campaign from Ad Studio and spend, conversions and ROAS will appear here with daily trends, platform comparison and AI performance analysis."
                  : "Connect Google Ads or Meta, publish a campaign from Ad Studio, and this dashboard fills with spend and conversion trends, platform comparison and AI performance analysis. No simulated numbers — only real campaign data."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {!anyConnected && (
                  <Link href="/integrations" className="btn-primary text-sm">
                    Connect an ad account
                  </Link>
                )}
                <Link href="/ad-studio" className="btn-secondary text-sm">
                  Open Ad Studio
                </Link>
              </div>
            </section>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}
