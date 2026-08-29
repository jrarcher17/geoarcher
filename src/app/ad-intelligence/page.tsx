"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { ComingSoon, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";

interface ProviderCap {
  id: string;
  name: string;
  platform: string;
  status: "ready" | "not_configured" | "unavailable";
  coverage: string;
  setup: string | null;
}

interface Context {
  kind: "offering" | "competitor" | null;
  name: string | null;
  category: string | null;
  companyName: string | null;
}

interface AdAnalysis {
  label: "AI Recommendation";
  hook: string | null;
  problem: string | null;
  promise: string | null;
  offer: string | null;
  audience: string | null;
  creativeStrategy: string | null;
  cta: string | null;
  messagingAngle: string;
  strengthScore: number;
  opportunityScore: number;
  strengthRationale: string;
  opportunityRationale: string;
  missing: string[];
}

interface DiscoveredAd {
  id: string;
  providerId: string;
  platform: string;
  externalId: string;
  advertiserName: string | null;
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  landingPage: string | null;
  creativeUrl: string | null;
  format: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  sourceUrl: string | null;
  publisherPlatforms: string[];
  analysis: AdAnalysis | null;
  analyzedAt: string | null;
  analyzable: boolean;
}

interface Payload {
  context: Context;
  providers: ProviderCap[];
  ready: boolean;
  countries: string[];
  searched: boolean;
  searchError: string | null;
  lastSearch: {
    at: string;
    terms: string;
    resultCount: number;
    error: string | null;
    provider: string;
  } | null;
  ads: DiscoveredAd[];
  storedCount: number;
  analyzedCount: number;
}

const STATUS_LABEL: Record<ProviderCap["status"], string> = {
  ready: "Ready",
  not_configured: "Integration required",
  unavailable: "No official API",
};

function AdIntelligenceInner() {
  const params = useSearchParams();
  const offering = params.get("offering") ?? "";
  const competitor = params.get("competitor") ?? "";
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"ALL" | "meta" | "google">("ALL");

  const query = offering
    ? `offering=${encodeURIComponent(offering)}`
    : competitor
      ? `competitor=${encodeURIComponent(competitor)}`
      : "";

  const load = useCallback(
    async (search: boolean) => {
      const qs = [query, search ? "search=1" : ""]
        .filter(Boolean)
        .join("&");
      const res = await fetch(`/api/me/ad-intelligence${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load.");
      setData(json);
    },
    [query]
  );

  useEffect(() => {
    let cancelled = false;
    load(false).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function search() {
    setSearching(true);
    setError(null);
    try {
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function analyze(id?: string) {
    setAnalyzing(id ?? "batch");
    setError(null);
    try {
      const res = await fetch("/api/me/ad-intelligence/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          offering: offering || undefined,
          competitor: competitor || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed.");
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(null);
    }
  }

  const ctx = data?.context;
  const subject =
    ctx?.name ??
    (offering || competitor ? "Loading…" : "Choose a product or competitor");
  const visible = (data?.ads ?? []).filter(
    (ad) => platform === "ALL" || ad.platform === platform
  );

  return (
    <AppShell
      title="Ad Intelligence"
      subtitle="Official ad libraries only. Analysis is an AI recommendation — not measured performance."
      actions={
        <div className="flex flex-wrap gap-2">
          {data &&
            (offering || competitor) &&
            data.ads.some((ad) => ad.analyzable && !ad.analysis) && (
            <button
              type="button"
              onClick={() => void analyze()}
              disabled={analyzing !== null}
              className="btn-secondary text-sm"
            >
              {analyzing === "batch" ? "Analyzing…" : "Analyze stored ads"}
            </button>
          )}
          {data?.ready && ctx?.name ? (
            <button
              type="button"
              onClick={() => void search()}
              disabled={searching}
              className="btn-primary text-sm"
            >
              {searching
                ? "Searching…"
                : data.lastSearch
                  ? "Refresh from library"
                  : "Search official libraries"}
            </button>
          ) : null}
        </div>
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {data && (
        <FadeIn className="flex flex-col gap-8">
          <section className="border border-slate-200 bg-white p-6 sm:p-8">
            <SectionLabel>
              {ctx?.kind === "competitor"
                ? "Analyzing competitor"
                : ctx?.kind === "offering"
                  ? "Analyzing product"
                  : "No subject selected"}
            </SectionLabel>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{subject}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {[ctx?.companyName, ctx?.category].filter(Boolean).join(" · ") ||
                "Open Analyze Ads from a product or competitor to set the search."}
            </p>
            {data.lastSearch && (
              <p className="mt-3 text-xs text-slate-400">
                Last search {new Date(data.lastSearch.at).toLocaleString()} ·{" "}
                {data.lastSearch.resultCount} returned
                {data.lastSearch.terms ? ` · “${data.lastSearch.terms}”` : ""}
              </p>
            )}
            {data.searchError && (
              <p className="mt-2 text-sm text-red-600">{data.searchError}</p>
            )}
            {!ctx?.kind && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/products" className="btn-primary text-sm">
                  Browse products
                </Link>
                <Link href="/competitors" className="btn-secondary text-sm">
                  Browse competitors
                </Link>
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Providers</SectionLabel>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {data.providers.map((p) => (
                <article
                  key={p.id}
                  className="border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {p.name}
                    </h3>
                    <span className="shrink-0 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {p.coverage}
                  </p>
                  {p.setup && (
                    <p className="mt-3 text-xs text-slate-400">{p.setup}</p>
                  )}
                </article>
              ))}
            </div>
          </section>

          {data.ads.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <SectionLabel>
                  {visible.length === 1
                    ? "1 stored library ad"
                    : `${visible.length} stored library ads`}
                  {data.analyzedCount > 0
                    ? ` · ${data.analyzedCount} analyzed`
                    : ""}
                </SectionLabel>
                <div className="flex gap-2">
                  {(
                    [
                      ["ALL", "All"],
                      ["meta", "Meta"],
                      ["google", "Google"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPlatform(id)}
                      className={
                        platform === id
                          ? "bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                          : "border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {visible.length === 0 && (
                <p className="text-sm text-slate-500">
                  No stored ads on this platform. Google has no official commercial API.
                </p>
              )}
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {visible.map((ad) => (
                  <article
                    key={ad.id}
                    className="flex flex-col border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {ad.platform}
                      </p>
                      <p className="text-xs text-slate-400">
                        {ad.advertiserName ?? "Advertiser not named"}
                      </p>
                    </div>
                    {ad.headline && (
                      <h3 className="mt-3 text-base font-semibold text-slate-900">
                        {ad.headline}
                      </h3>
                    )}
                    {ad.primaryText && (
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                        {ad.primaryText}
                      </p>
                    )}
                    {ad.cta && (
                      <p className="mt-2 text-sm font-medium text-slate-900">{ad.cta}</p>
                    )}
                    <p className="mt-3 text-xs text-slate-400">
                      {[
                        ad.firstSeen
                          ? `First delivered ${ad.firstSeen.slice(0, 10)}`
                          : null,
                        ad.lastSeen ? `Last ${ad.lastSeen.slice(0, 10)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No dates returned by the library"}
                    </p>
                    {ad.analysis ? (
                      <AnalysisBlock analysis={ad.analysis} />
                    ) : ad.analyzable ? (
                      <button
                        type="button"
                        onClick={() => void analyze(ad.id)}
                        disabled={analyzing !== null}
                        className="btn-secondary mt-4 text-sm"
                      >
                        {analyzing === ad.id ? "Analyzing…" : "Analyze copy"}
                      </button>
                    ) : (
                      <p className="mt-4 text-xs text-slate-400">
                        Library returned no copy — cannot analyze.
                      </p>
                    )}
                    {ad.sourceUrl && (
                      <a
                        href={ad.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary mt-4 text-sm"
                      >
                        View in library
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.ads.length === 0 && data.lastSearch && (
            <ComingSoon
              status="No ads returned"
              title="The connected libraries found nothing for this search"
              body="That is a real empty result — not a placeholder. Try another product or competitor, or a different country list in META_AD_LIBRARY_COUNTRIES."
            />
          )}

          {data.ads.length === 0 && !data.ready && (
            <ComingSoon
              status="Integration required"
              title="Competitor ad discovery is not connected yet"
              body={`Meta Ad Library can search once META_AD_LIBRARY_ACCESS_TOKEN is set. Default countries: ${data.countries.join(", ")}. Google commercial ads stay unavailable until Google ships an official API. Analysis runs only on stored library ads — nothing is invented.`}
            />
          )}

          {data.ads.length === 0 && data.ready && ctx?.name && !data.lastSearch && (
            <p className="text-sm text-slate-500">
              A library is configured. Search to pull ads Meta actually archived — nothing
              is generated.
            </p>
          )}

          {data.ads.length === 0 && data.ready && !ctx?.kind && (
            <p className="text-sm text-slate-500">
              Nothing stored yet. Open a product or competitor and search an official library.
            </p>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}

const ANALYSIS_FIELDS: Array<[keyof AdAnalysis, string]> = [
  ["hook", "Hook"],
  ["problem", "Problem"],
  ["promise", "Promise"],
  ["offer", "Offer"],
  ["audience", "Audience"],
  ["creativeStrategy", "Creative strategy"],
  ["cta", "CTA"],
];

function AnalysisBlock({ analysis }: { analysis: AdAnalysis }) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {analysis.label}
      </p>
      <div className="mt-3 flex gap-6">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">
            {analysis.strengthScore}
          </p>
          <p className="text-xs text-slate-500">Strength</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">
            {analysis.opportunityScore}
          </p>
          <p className="text-xs text-slate-500">Opportunity</p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        {analysis.strengthRationale}
      </p>
      {analysis.opportunityRationale && (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {analysis.opportunityRationale}
        </p>
      )}
      <p className="mt-3 text-xs font-medium text-slate-700">
        Angle · {analysis.messagingAngle}
      </p>
      <dl className="mt-3 space-y-2">
        {ANALYSIS_FIELDS.map(([key, label]) => {
          const value = analysis[key];
          if (typeof value !== "string" || !value) return null;
          return (
            <div key={key}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-slate-700">{value}</dd>
            </div>
          );
        })}
      </dl>
      {analysis.missing.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Not in the stored copy: {analysis.missing.join(", ")}
        </p>
      )}
    </div>
  );
}

export default function AdIntelligencePage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Ad Intelligence">
          <Skeleton className="h-40" />
        </AppShell>
      }
    >
      <AdIntelligenceInner />
    </Suspense>
  );
}
