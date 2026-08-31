"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  ChannelChips,
  KpiCard,
  LevelBadge,
} from "@/components/ads/primitives";
import {
  ComingSoon,
  EmptyState,
  ErrorBanner,
  OnboardingSteps,
  SectionLabel,
} from "@/components/os/primitives";
import { StrategyCta } from "@/components/strategy/StrategyCta";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, greeting } from "@/lib/advertising/format";
import { hostOf } from "@/lib/utils";

interface BusinessProfileLite {
  companyName?: string;
  description?: string;
  industry?: string;
}

interface CommandCenter {
  kpis: { totalCampaigns: number; draftCampaigns: number };
  analyzedAds: number;
  adIntelligenceScore: {
    label: string;
    overall: number;
    groundedAdCount: number;
  } | null;
  sites: {
    siteId: string;
    url: string;
    latestScan: { id: string; status: string } | null;
    intelligenceStatus: string | null;
    business: BusinessProfileLite | null;
    offerings: number;
    opportunities: number;
    competitors: number;
    libraryAds: number;
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
  competitorGaps: {
    id: string;
    title: string;
    rationale: string;
    siteId: string;
    siteUrl: string;
    offering: { id: string; name: string; kind: string } | null;
    gap: { opportunityScore: number; recommendedAngle: string; label: string } | null;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<CommandCenter | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/command-center", { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load.");
    setData(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const productCount = data?.sites.reduce((n, s) => n + s.offerings, 0) ?? 0;
  const opportunityCount = data?.sites.reduce((n, s) => n + s.opportunities, 0) ?? 0;
  const gapCount = data?.competitorGaps.length ?? 0;
  const score = data?.adIntelligenceScore ?? null;
  const competitorCount = data?.sites.reduce((n, s) => n + (s.competitors ?? 0), 0) ?? 0;
  const libraryAdCount = data?.sites.reduce((n, s) => n + (s.libraryAds ?? 0), 0) ?? 0;
  const analyzedAdCount = data?.analyzedAds ?? 0;
  const scanning = data?.sites.some((s) =>
    ["QUEUED", "CRAWLING", "ANALYZING"].includes(s.latestScan?.status ?? "")
  );
  const primary = data?.sites.find((s) => s.intelligenceStatus === "COMPLETE");
  const business = primary?.business ?? null;
  const nextMove = data?.opportunities[0] ?? null;

  return (
    <AppShell
      title={greeting()}
      subtitle={
        productCount > 0
          ? "What should you advertise next — from your scanned websites."
          : "Scan a website. We'll find the products and the ads worth making."
      }
      live={Boolean(scanning)}
    >
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            setError(null);
            void load().catch((err) =>
              setError(err instanceof Error ? err.message : "Failed to load.")
            );
          }}
        />
      )}
      {!data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {data && data.sites.length === 0 && (
        <div className="flex flex-col gap-6">
          <EmptyState
            title="See what you should advertise"
            body="Add a product — scan one webpage or enter it yourself. Then create ads from what that page actually says."
            actionHref="/products"
            actionLabel="Add a product"
          />
          <OnboardingSteps
            title="Your first advertising workspace"
            body="Nothing here is invented. Each step uses a product you add or an ad you create."
            steps={[
              { label: "Add a product", done: false, href: "/products" },
              { label: "Create an ad", done: false, href: "/ad-studio" },
            ]}
          />
        </div>
      )}

      {data && data.sites.length > 0 && (
        <FadeIn className="flex flex-col gap-8">
          {productCount === 0 || (data.kpis.totalCampaigns ?? 0) === 0 ? (
            <OnboardingSteps
              title="Next in your workspace"
              body="Finish the path from a real product to a reviewable ad."
              steps={[
                {
                  label: "Add a product",
                  done: productCount > 0,
                  href: "/products",
                },
                {
                  label: "Create an ad",
                  done: (data.kpis.totalCampaigns ?? 0) > 0,
                  href: "/ad-studio",
                },
              ]}
            />
          ) : null}
          {business && (
            <section className="border border-slate-200 bg-white px-6 py-5">
              <SectionLabel>Your business</SectionLabel>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {business.companyName || hostOf(primary!.url)}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {primary!.url}
                {business.industry ? ` · ${business.industry}` : ""}
              </p>
              {business.description && (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                  {business.description}
                </p>
              )}
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Products & services"
              value={formatCount(productCount)}
              hint="Extracted from your scans"
            />
            <KpiCard
              label="Website opportunities"
              value={formatCount(opportunityCount)}
              hint="From site content — not competitor ads"
            />
            <KpiCard
              label="Competitors"
              value={formatCount(competitorCount)}
              hint="AI recommendations + brands you added"
            />
            <KpiCard
              label="Ads analyzed"
              value={formatCount(analyzedAdCount)}
              hint={
                analyzedAdCount > 0
                  ? "AI recommendations — not measured performance"
                  : libraryAdCount > 0
                    ? `${libraryAdCount} stored · not analyzed yet`
                    : "Official libraries only — nothing invented"
              }
            />
          </section>

          {nextMove ? (
            <section className="border border-slate-200 bg-white p-6 sm:p-8">
              <SectionLabel>Recommended next move</SectionLabel>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">
                {nextMove.offering
                  ? `Promote ${nextMove.offering.name}`
                  : nextMove.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                {nextMove.rationale}
              </p>
              <p className="mt-2 text-xs text-slate-400">{hostOf(nextMove.siteUrl)}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/ad-studio?site=${nextMove.siteId}${nextMove.offering ? `&offering=${nextMove.offering.id}` : ""}`}
                  className="btn-primary text-sm"
                >
                  Create Ad
                </Link>
                <Link href="/opportunities" className="btn-secondary text-sm">
                  View all opportunities
                </Link>
              </div>
            </section>
          ) : scanning ? (
            <p className="text-sm text-slate-500">
              Scan in progress — recommended ads appear when extraction finishes.
            </p>
          ) : (
            <div className="border border-dashed border-slate-300 bg-white px-6 py-8">
              <p className="text-sm font-medium text-slate-900">
                No website opportunities yet
              </p>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Finish a scan so GEO Archer can identify what to advertise from the
                site itself.
              </p>
              <Link href="/products" className="btn-primary mt-4 inline-block text-sm">
                Go to Products
              </Link>
            </div>
          )}

          {data.opportunities.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between">
                <SectionLabel>Top advertising opportunities</SectionLabel>
                <Link
                  href="/opportunities"
                  className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.opportunities.slice(0, 3).map((o) => (
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
                    <div className="mt-3">
                      <ChannelChips channels={o.channels} />
                    </div>
                    <Link
                      href={`/ad-studio?site=${o.siteId}${o.offering ? `&offering=${o.offering.id}` : ""}`}
                      className="btn-primary mt-4 text-sm"
                    >
                      Create Ad
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {gapCount > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between">
                <SectionLabel>Competitor gaps</SectionLabel>
                <Link
                  href="/opportunities"
                  className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.competitorGaps.slice(0, 3).map((o) => (
                  <article
                    key={o.id}
                    className="flex flex-col border border-slate-200 bg-white p-5"
                  >
                    <h3 className="text-base font-semibold text-slate-900">{o.title}</h3>
                    {o.gap && (
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                        {o.gap.opportunityScore}
                        <span className="ml-1 text-xs font-medium text-slate-400">
                          · {o.gap.label}
                        </span>
                      </p>
                    )}
                    {o.gap?.recommendedAngle && (
                      <blockquote className="mt-3 border-l-2 border-slate-900 pl-3 text-sm font-medium text-slate-900">
                        {o.gap.recommendedAngle}
                      </blockquote>
                    )}
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                      {o.rationale}
                    </p>
                    <Link
                      href={`/ad-studio?site=${o.siteId}${o.offering ? `&offering=${o.offering.id}` : ""}&opportunity=${o.id}`}
                      className="btn-primary mt-4 text-sm"
                    >
                      Create Ad
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {competitorCount > 0 ? (
            <section>
              <div className="mb-3 flex items-end justify-between">
                <SectionLabel>Competitors</SectionLabel>
                <Link
                  href="/competitors"
                  className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  View all
                </Link>
              </div>
              <p className="text-sm text-slate-600">
                {competitorCount === 1
                  ? "1 brand suggested from your products."
                  : `${formatCount(competitorCount)} brands suggested from your products.`}
                Ad activity appears after a library is connected — not invented.
              </p>
              <Link href="/competitors" className="btn-secondary mt-4 inline-block text-sm">
                Open competitors
              </Link>
            </section>
          ) : (
            <ComingSoon
              status="Ready when you are"
              title="Find competitors from your products"
              body="GEO Archer can recommend brands in the same category as your scanned offerings. It will not invent ads, spend, or that they are advertising."
            />
          )}

          {score ? (
            <section className="border border-slate-200 bg-white p-6 sm:p-8">
              <SectionLabel>Ad Intelligence Score</SectionLabel>
              <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight text-slate-900">
                {score.overall}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                {score.label} from {score.groundedAdCount} analyzed library ads — not
                measured performance.
              </p>
              <Link href="/opportunities" className="btn-secondary mt-5 text-sm">
                See competitor gaps
              </Link>
            </section>
          ) : analyzedAdCount > 0 ? (
            <section className="border border-slate-200 bg-white p-6 sm:p-8">
              <SectionLabel>Ad analysis</SectionLabel>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">
                {analyzedAdCount === 1
                  ? "1 stored library ad analyzed"
                  : `${analyzedAdCount} stored library ads analyzed`}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Analyze at least two ads to compare angles and score the landscape.
                Scores are AI recommendations — not spend or clicks.
              </p>
              <Link href="/ad-intelligence" className="btn-secondary mt-5 text-sm">
                Review analyses
              </Link>
            </section>
          ) : libraryAdCount > 0 ? (
            <section className="border border-dashed border-slate-300 bg-white p-6 sm:p-8">
              <SectionLabel>Ready to analyze</SectionLabel>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">
                Library ads are stored
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                {libraryAdCount} official-library ads are waiting for AI analysis.
                Scores will be recommendations, not measured performance.
              </p>
              <Link href="/ad-intelligence" className="btn-secondary mt-5 text-sm">
                Open Ad Intelligence
              </Link>
            </section>
          ) : (
            <ComingSoon
              status="Integration required"
              title="Competitor ad activity"
              body="Ads analyzed and an Ad Intelligence Score will appear here after official ad-library providers are connected. We will not invent those numbers."
            />
          )}

          <StrategyCta />

          <section>
            <div className="mb-3 flex items-end justify-between">
              <SectionLabel>Products</SectionLabel>
              <Link
                href="/products"
                className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.sites.map((s) => {
                const biz = s.business as BusinessProfileLite | null;
                return (
                  <Link
                    key={s.siteId}
                    href="/products"
                    className="border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <p className="font-semibold text-slate-900">
                      {biz?.companyName || hostOf(s.url)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{s.url}</p>
                    <p className="mt-4 text-sm text-slate-600">
                      {s.offerings} products &amp; services · {s.opportunities}{" "}
                      opportunities
                    </p>
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
