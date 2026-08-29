"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { ChannelChips, LevelBadge } from "@/components/ads/primitives";
import {
  ComingSoon,
  EmptyState,
  ErrorBanner,
  SectionLabel,
} from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { hostOf } from "@/lib/utils";

interface Opportunity {
  id: string;
  title: string;
  level: string;
  rationale: string;
  channels: unknown;
  siteId: string;
  siteUrl: string;
  offering: { id: string; name: string; kind: string } | null;
}

interface GapOpportunity extends Opportunity {
  gap: {
    label: string;
    focusedOn: string[];
    missing: string[];
    recommendedAngle: string;
    opportunityScore: number;
    groundedAdCount: number;
  } | null;
}

interface Score {
  label: string;
  overall: number;
  breakdown: {
    competitorCoverage: number;
    messagingOpportunity: number;
    creativeOpportunity: number;
    offerOpportunity: number;
    audienceOpportunity: number;
  };
  groundedAdCount: number;
  advertiserCount: number;
}

interface Payload {
  site: Opportunity[];
  gaps: GapOpportunity[];
  score: Score | null;
  analyzedCount: number;
  libraryAdCount: number;
  canFindGaps: boolean;
  hasSites: boolean;
}

const BREAKDOWN: Array<[keyof Score["breakdown"], string]> = [
  ["competitorCoverage", "Competitor coverage"],
  ["messagingOpportunity", "Messaging"],
  ["creativeOpportunity", "Creative"],
  ["offerOpportunity", "Offer"],
  ["audienceOpportunity", "Audience"],
];

export default function OpportunitiesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/opportunities", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load.");
    setData(json);
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

  async function findGaps() {
    setFinding(true);
    setError(null);
    try {
      const res = await fetch("/api/me/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not find gaps.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find gaps.");
    } finally {
      setFinding(false);
    }
  }

  return (
    <AppShell
      title="Opportunities"
      subtitle="Website opportunities come from your scan. Competitor gaps come from analyzed library ads — not invented."
      actions={
        data?.canFindGaps ? (
          <button
            type="button"
            onClick={() => void findGaps()}
            disabled={finding}
            className="btn-primary text-sm"
          >
            {finding ? "Finding gaps…" : "Find competitor gaps"}
          </button>
        ) : null
      }
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      )}

      {data && !data.hasSites && (
        <EmptyState
          title="Scan a website first"
          body="Opportunities are generated from a completed site scan — not invented."
          actionHref="/sites"
          actionLabel="Add a website"
        />
      )}

      {data && data.hasSites && (
        <FadeIn className="flex flex-col gap-8">
          {data.score && <ScorePanel score={data.score} />}

          <section>
            <SectionLabel>From your website</SectionLabel>
            {data.site.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No open website opportunities yet. Finish a scan, then return here.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.site.map((o) => (
                  <OpportunityCard key={o.id} opportunity={o} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Competitor gaps</SectionLabel>
            {data.gaps.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.gaps.map((o) => (
                  <GapCard key={o.id} opportunity={o} />
                ))}
              </div>
            ) : data.canFindGaps ? (
              <p className="mt-3 text-sm text-slate-500">
                {data.analyzedCount} library ads are analyzed. Find gaps to compare
                their angles with your products — scores are AI recommendations.
              </p>
            ) : data.libraryAdCount > 0 ? (
              <ComingSoon
                status="Analyze ads first"
                title="Gaps need analyzed library ads"
                body={`${data.libraryAdCount} official-library ads are stored. Analyze at least two, then we can compare angles. Nothing is invented.`}
              />
            ) : (
              <ComingSoon
                status="Integration required"
                title="Competitor-gap opportunities"
                body="After official libraries return ads and those ads are analyzed, this page will show angles competitors underuse. Those scores will be labeled as AI recommendations, not measured ad performance."
              />
            )}
          </section>
        </FadeIn>
      )}
    </AppShell>
  );
}

function OpportunityCard({ opportunity: o }: { opportunity: Opportunity }) {
  return (
    <article className="flex flex-col border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{o.title}</h2>
        <LevelBadge level={o.level} />
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{o.rationale}</p>
      <p className="mt-2 text-xs text-slate-400">
        {o.offering?.name ? `${o.offering.name} · ` : ""}
        {hostOf(o.siteUrl)}
      </p>
      <div className="mt-3">
        <ChannelChips channels={o.channels} />
      </div>
      <Link
        href={`/ad-studio?site=${o.siteId}${o.offering ? `&offering=${o.offering.id}` : ""}&opportunity=${o.id}`}
        className="btn-primary mt-4 text-sm"
      >
        Create Ad
      </Link>
    </article>
  );
}

function GapCard({ opportunity: o }: { opportunity: GapOpportunity }) {
  const gap = o.gap;
  return (
    <article className="flex flex-col border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{o.title}</h2>
        <LevelBadge level={o.level} />
      </div>
      {gap && (
        <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
          {gap.opportunityScore}
          <span className="ml-1 text-xs font-medium text-slate-400">
            / 100 · {gap.label}
          </span>
        </p>
      )}
      {gap && gap.focusedOn.length > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Competitors focus on </span>
          {gap.focusedOn.join(", ")}
        </p>
      )}
      {gap && gap.missing.length > 0 && (
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Few emphasize </span>
          {gap.missing.join(", ")}
        </p>
      )}
      {gap?.recommendedAngle && (
        <blockquote className="mt-3 border-l-2 border-slate-900 pl-3 text-sm font-medium text-slate-900">
          {gap.recommendedAngle}
        </blockquote>
      )}
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{o.rationale}</p>
      <p className="mt-2 text-xs text-slate-400">
        {o.offering?.name ? `${o.offering.name} · ` : ""}
        {hostOf(o.siteUrl)}
        {gap?.groundedAdCount
          ? ` · ${gap.groundedAdCount} analyzed ads`
          : ""}
      </p>
      <div className="mt-3">
        <ChannelChips channels={o.channels} />
      </div>
      <Link
        href={`/ad-studio?site=${o.siteId}${o.offering ? `&offering=${o.offering.id}` : ""}&opportunity=${o.id}`}
        className="btn-primary mt-4 text-sm"
      >
        Create Ad
      </Link>
    </article>
  );
}

function ScorePanel({ score }: { score: Score }) {
  return (
    <section className="border border-slate-200 bg-white p-6 sm:p-8">
      <SectionLabel>Ad Intelligence Score</SectionLabel>
      <div className="mt-4 flex flex-wrap items-end gap-8">
        <div>
          <p className="text-5xl font-semibold tabular-nums tracking-tight text-slate-900">
            {score.overall}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {score.label} · {score.groundedAdCount} analyzed ads ·{" "}
            {score.advertiserCount} advertisers
          </p>
        </div>
        <dl className="grid min-w-[16rem] flex-1 gap-3 sm:grid-cols-2">
          {BREAKDOWN.map(([key, label]) => (
            <div key={key}>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-slate-900">
                  {score.breakdown[key]}
                </dd>
              </div>
              <div className="mt-1 h-1 bg-slate-100">
                <div
                  className="h-1 bg-slate-900"
                  style={{ width: `${score.breakdown[key]}%` }}
                />
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
