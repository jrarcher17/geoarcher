"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  ChannelChips,
  KpiCard,
  LevelBadge,
} from "@/components/ads/primitives";
import { EmptyState, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCount,
  formatMoney,
  formatRoas,
  greeting,
} from "@/lib/advertising/format";
import { hostOf } from "@/lib/utils";

interface BusinessProfileLite {
  companyName?: string;
  description?: string;
  industry?: string;
}

interface CommandCenter {
  kpis: {
    activeCampaigns: number;
    draftCampaigns: number;
    totalCampaigns: number;
    spendCents: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpaCents: number | null;
    roas: number | null;
  };
  sites: {
    siteId: string;
    url: string;
    latestScan: { id: string; status: string } | null;
    intelligenceStatus: string | null;
    business: BusinessProfileLite | null;
    offerings: number;
    images: number;
    opportunities: number;
  }[];
  opportunities: {
    id: string;
    title: string;
    level: string;
    rationale: string;
    channels: unknown;
    siteId: string;
    siteUrl: string;
    offering: { id: string; name: string; kind: string } | null;
  }[];
  connections: {
    google: { connected: boolean; accountName: string | null };
    meta: { connected: boolean; accountName: string | null };
    openai: boolean;
  };
  alerts: {
    id: string;
    type: string;
    title: string;
    detail: string;
    campaignId: string | null;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<CommandCenter | null>(null);
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

  const hasCampaigns = (data?.kpis.totalCampaigns ?? 0) > 0;
  const hasIntelligence = data?.sites.some((s) => s.intelligenceStatus === "COMPLETE");
  const scanning = data?.sites.some((s) =>
    ["QUEUED", "CRAWLING", "ANALYZING"].includes(s.latestScan?.status ?? "")
  );

  return (
    <AppShell
      title={greeting()}
      subtitle="Your advertising command center — what's running, what's working, and what to launch next."
      live={Boolean(scanning)}
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {data && data.sites.length === 0 && (
        <EmptyState
          title="Turn your website into your advertising engine"
          body="Add your website and GEO Archer will scan it, understand your business, identify the products and services worth advertising, and prepare campaigns."
          actionHref="/sites"
          actionLabel="+ Add Site"
        />
      )}

      {data && data.sites.length > 0 && (
        <FadeIn className="flex flex-col gap-8">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Active Campaigns"
              value={formatCount(data.kpis.activeCampaigns)}
              hint={
                data.kpis.draftCampaigns > 0
                  ? `${data.kpis.draftCampaigns} drafts in Ad Studio`
                  : undefined
              }
            />
            <KpiCard
              label="Ad Spend"
              value={formatMoney(hasCampaigns ? data.kpis.spendCents : null)}
              hint="Last 30 days"
            />
            <KpiCard
              label="Conversions"
              value={hasCampaigns ? formatCount(data.kpis.conversions) : "—"}
              hint="Last 30 days"
            />
            <KpiCard label="Average CPA" value={formatMoney(data.kpis.cpaCents)} />
            <KpiCard label="ROAS" value={formatRoas(data.kpis.roas)} />
          </section>

          {!data.connections.google.connected && !data.connections.meta.connected && (
            <section className="border border-slate-200 bg-white px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    No ad accounts connected
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Connect Google Ads or Meta to publish campaigns and pull live
                    performance data. Until then, campaigns stay as ready-to-publish
                    drafts.
                  </p>
                </div>
                <Link href="/integrations" className="btn-secondary shrink-0 text-sm">
                  Open Integrations
                </Link>
              </div>
            </section>
          )}

          <section>
            <SectionLabel>AI Alerts</SectionLabel>
            {data.alerts.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {data.alerts.map((a) => (
                  <article key={a.id} className="border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-slate-900">{a.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{a.detail}</p>
                    <Link
                      href="/assistant"
                      className="mt-2 inline-block text-xs font-medium text-slate-900 underline underline-offset-2"
                    >
                      Review in Assistant
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {hasCampaigns
                  ? "No alerts right now. AI monitors campaign performance and flags anything that needs attention."
                  : "Once campaigns are running, AI monitors performance and alerts you to rising costs, winning campaigns, and creative fatigue."}
              </p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <SectionLabel>Advertising opportunities</SectionLabel>
                <p className="mt-2 text-sm text-slate-500">
                  What your website says you should be advertising.
                </p>
              </div>
              {hasIntelligence && (
                <Link
                  href="/ad-studio"
                  className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  Open Ad Studio
                </Link>
              )}
            </div>

            {data.opportunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.opportunities.map((o) => (
                  <article
                    key={o.id}
                    className="flex flex-col border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {o.title}
                      </h3>
                      <LevelBadge level={o.level} />
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                      {o.rationale}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{hostOf(o.siteUrl)}</p>
                    <div className="mt-3">
                      <ChannelChips channels={o.channels} />
                    </div>
                    <div className="mt-4">
                      <Link
                        href={`/ad-studio?site=${o.siteId}${o.offering ? `&offering=${o.offering.id}` : ""}`}
                        className="btn-primary text-sm"
                      >
                        Create Ad
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : scanning ? (
              <p className="text-sm text-slate-500">
                Scan in progress — advertising opportunities appear when the AI
                intelligence extraction finishes.
              </p>
            ) : hasIntelligence ? (
              <p className="text-sm text-slate-500">
                No open opportunities. Re-run intelligence from a site page after
                content changes.
              </p>
            ) : (
              <div className="border border-dashed border-slate-300 bg-white px-6 py-8">
                <p className="text-sm font-medium text-slate-900">
                  Your sites haven&apos;t been analyzed for advertising yet.
                </p>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Open a site and run the advertising intelligence scan. GEO Archer
                  will identify your products, services, images and the campaigns
                  worth launching.
                </p>
                <Link href="/sites" className="btn-primary mt-4 inline-block text-sm">
                  Go to Sites
                </Link>
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Sites</SectionLabel>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.sites.map((s) => {
                const business = s.business as BusinessProfileLite | null;
                return (
                  <Link
                    key={s.siteId}
                    href={`/sites/${s.siteId}/intelligence`}
                    className="group border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <p className="font-semibold text-slate-900">
                      {business?.companyName || hostOf(s.url)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{s.url}</p>
                    {s.intelligenceStatus === "COMPLETE" ? (
                      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <dt className="text-[11px] text-slate-400">Offerings</dt>
                          <dd className="text-lg font-semibold tabular-nums text-slate-900">
                            {s.offerings}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-400">Images</dt>
                          <dd className="text-lg font-semibold tabular-nums text-slate-900">
                            {s.images}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-400">Opportunities</dt>
                          <dd className="text-lg font-semibold tabular-nums text-slate-900">
                            {s.opportunities}
                          </dd>
                        </div>
                      </dl>
                    ) : s.intelligenceStatus === "RUNNING" ? (
                      <p className="mt-4 text-sm text-sky-700">
                        Extracting advertising intelligence…
                      </p>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        Not analyzed for advertising yet.
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        </FadeIn>
      )}
    </AppShell>
  );
}
