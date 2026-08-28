"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  ConversionTrendChart,
  PlatformCompareChart,
  SpendTrendChart,
} from "@/components/ads/charts";
import {
  CampaignStatusBadge,
  KpiCard,
  PlatformBadge,
} from "@/components/ads/primitives";
import { EmptyState, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatRoas,
} from "@/lib/advertising/format";
import { cn, hostOf } from "@/lib/utils";

interface Derived {
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenueCents: number;
  ctr: number | null;
  cpcCents: number | null;
  cpaCents: number | null;
  roas: number | null;
}

interface AnalyticsPayload {
  range: { days: number; start: string; end: string };
  hasData: boolean;
  totals: Derived;
  daily: Array<
    Derived & {
      date: string;
    }
  >;
  platforms: Array<{ platform: string } & Derived>;
  campaigns: Array<
    {
      id: string;
      name: string;
      platform: string;
      status: string;
      site: { id: string; url: string } | null;
      offering: { id: string; name: string } | null;
    } & Derived
  >;
  notes: { title: string; detail: string; tone: string }[];
  connections: {
    google: { connected: boolean; accountName: string | null };
    meta: { connected: boolean; accountName: string | null };
  };
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

const PLATFORMS = [
  { value: "ALL", label: "All platforms" },
  { value: "GOOGLE", label: "Google" },
  { value: "META", label: "Meta" },
] as const;

const TONE: Record<string, string> = {
  positive: "border-emerald-200 bg-emerald-50/60",
  watch: "border-amber-200 bg-amber-50/60",
  neutral: "border-slate-200 bg-white",
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["value"]>("ALL");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    const params = new URLSearchParams({ days: String(days) });
    if (platform !== "ALL") params.set("platform", platform);
    fetch(`/api/analytics?${params}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          if (json.upgradeRequired) {
            if (!cancelled) setUpgrade(true);
            return null;
          }
          throw new Error(json.error ?? "Failed to load analytics.");
        }
        return json as AnalyticsPayload;
      })
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load analytics.");
      });
    return () => {
      cancelled = true;
    };
  }, [days, platform]);

  async function analyzeWithAi() {
    setAiBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: String(days), insights: "ai" });
      if (platform !== "ALL") params.set("platform", platform);
      const res = await fetch(`/api/analytics?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAiBusy(false);
    }
  }

  const kpis = data?.totals;
  const anyConnected =
    data?.connections.google.connected || data?.connections.meta.connected;

  return (
    <AppShell
      title="Analytics"
      subtitle="Advertising performance across every platform — only numbers synced from live campaigns."
    >
      {error && (
        <p className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {upgrade && (
        <EmptyState
          title="Analytics is a Pro feature"
          body="Upgrade to Pro to see spend, conversions and ROAS for campaigns created in Ad Studio."
          actionHref="/settings?tab=billing"
          actionLabel="Upgrade to Pro"
        />
      )}

      {!data && !error && !upgrade && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {data && kpis && (
        <FadeIn className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  type="button"
                  onClick={() => setDays(r.days)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium",
                    days === r.days
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-500 hover:text-slate-800"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlatform(p.value)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium",
                    platform === p.value
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-500 hover:text-slate-800"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Spend"
              value={formatMoney(data.hasData ? kpis.spendCents : null)}
              hint={data.hasData ? `${data.range.start} – ${data.range.end}` : undefined}
            />
            <KpiCard
              label="Impressions"
              value={data.hasData ? formatCount(kpis.impressions) : "—"}
            />
            <KpiCard
              label="Clicks"
              value={data.hasData ? formatCount(kpis.clicks) : "—"}
            />
            <KpiCard label="CTR" value={formatPercent(kpis.ctr)} />
            <KpiCard
              label="Conversions"
              value={data.hasData ? formatCount(kpis.conversions) : "—"}
            />
            <KpiCard label="CPA" value={formatMoney(kpis.cpaCents)} />
            <KpiCard
              label="Revenue"
              value={data.hasData ? formatMoney(kpis.revenueCents) : "—"}
            />
            <KpiCard label="ROAS" value={formatRoas(kpis.roas)} />
          </section>

          {!data.hasData && (
            <section className="border border-dashed border-slate-300 bg-white px-6 py-10">
              <SectionLabel>No performance data yet</SectionLabel>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Charts stay empty until a campaign actually runs
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                {anyConnected
                  ? "Your ad account is connected. Publish a campaign from Ad Studio and daily spend, conversions and ROAS will appear here. No simulated numbers."
                  : "Connect Google Ads or Meta, publish a campaign, and this dashboard fills with real spend and conversion trends. Nothing here is estimated or demo data."}
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
                <Link href="/campaigns" className="btn-secondary text-sm">
                  View campaigns
                </Link>
              </div>
            </section>
          )}

          {data.hasData && (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="border border-slate-200 bg-white p-5">
                  <SectionLabel>Daily spend</SectionLabel>
                  <div className="mt-3">
                    <SpendTrendChart data={data.daily} />
                  </div>
                </div>
                <div className="border border-slate-200 bg-white p-5">
                  <SectionLabel>Daily conversions</SectionLabel>
                  <div className="mt-3">
                    <ConversionTrendChart data={data.daily} />
                  </div>
                </div>
              </section>

              <section className="border border-slate-200 bg-white p-5">
                <SectionLabel>Platform comparison</SectionLabel>
                <div className="mt-3">
                  <PlatformCompareChart data={data.platforms} />
                </div>
              </section>

              {data.notes.length > 0 && (
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionLabel>What the numbers say</SectionLabel>
                    <button
                      type="button"
                      className="btn-secondary text-xs disabled:opacity-60"
                      disabled={aiBusy}
                      onClick={() => void analyzeWithAi()}
                    >
                      {aiBusy ? "Analyzing…" : "Analyze with AI"}
                    </button>
                  </div>
                  <ul className="mt-3 grid gap-3 md:grid-cols-2">
                    {data.notes.map((n) => (
                      <li
                        key={n.title}
                        className={cn("border px-4 py-3", TONE[n.tone] ?? TONE.neutral)}
                      >
                        <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {n.detail}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {data.campaigns.length > 0 && (
            <section>
              <SectionLabel>Campaigns in this window</SectionLabel>
              <div className="mt-3 overflow-x-auto border border-slate-200 bg-white">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Campaign</th>
                      <th className="px-4 py-3">Platform</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Spend</th>
                      <th className="px-4 py-3 text-right">Clicks</th>
                      <th className="px-4 py-3 text-right">Conv.</th>
                      <th className="px-4 py-3 text-right">CPA</th>
                      <th className="px-4 py-3 text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 last:border-0"
                        onClick={() => router.push(`/campaigns/${c.id}`)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-400">
                            {c.site ? hostOf(c.site.url) : "—"}
                            {c.offering ? ` · ${c.offering.name}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <PlatformBadge platform={c.platform} />
                        </td>
                        <td className="px-4 py-3">
                          <CampaignStatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(c.spendCents)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCount(c.clicks)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCount(c.conversions)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(c.cpaCents)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatRoas(c.roas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Draft and Ready campaigns show $0 until they run on a connected ad
                account.
              </p>
            </section>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}
