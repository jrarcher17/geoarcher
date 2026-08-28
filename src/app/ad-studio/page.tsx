"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { LevelBadge } from "@/components/ads/primitives";
import { EmptyState, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/lib/useInsights";
import { cn, hostOf } from "@/lib/utils";

interface OfferingItem {
  id: string;
  kind: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  price: string | null;
  url: string | null;
  images: { id: string; url: string; alt: string | null }[];
}

interface OpportunityItem {
  id: string;
  title: string;
  level: string;
  rationale: string;
  recommendedCampaign: {
    name?: string;
    goal?: string;
    audience?: string;
    budgetHint?: string;
  } | null;
  offering: { id: string; name: string; kind: string } | null;
}

interface Intelligence {
  status: string | null;
  hasCompletedScan: boolean;
  offerings: OfferingItem[];
  opportunities: OpportunityItem[];
}

function AdStudioInner() {
  const params = useSearchParams();
  const { data: insights } = useInsights();
  const [siteId, setSiteId] = useState<string | null>(params.get("site"));
  const [selected, setSelected] = useState<string | null>(params.get("offering"));
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sites = useMemo(() => insights?.sites ?? [], [insights]);

  useEffect(() => {
    if (!siteId && sites.length > 0) setSiteId(sites[0].siteId);
  }, [siteId, sites]);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setLoading(true);
    setIntel(null);
    fetch(`/api/sites/${siteId}/intelligence`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load.");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setIntel(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const selectedOffering = intel?.offerings.find((o) => o.id === selected) ?? null;
  const relatedOpportunity =
    intel?.opportunities.find((op) => op.offering?.id === selected) ?? null;

  return (
    <AppShell
      title="Ad Studio"
      subtitle="Create advertising campaigns from what your website already says."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {insights && sites.length === 0 && (
        <EmptyState
          title="Ad Studio needs a scanned website"
          body="Add your site and GEO Archer will identify the products and services you can advertise."
          actionHref="/sites"
          actionLabel="+ Add Site"
        />
      )}

      {sites.length > 0 && (
        <FadeIn className="flex flex-col gap-8">
          {sites.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {sites.map((s) => (
                <button
                  key={s.siteId}
                  type="button"
                  onClick={() => {
                    setSiteId(s.siteId);
                    setSelected(null);
                  }}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium",
                    siteId === s.siteId
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-500 hover:text-slate-800"
                  )}
                >
                  {hostOf(s.url)}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          )}

          {intel && intel.offerings.length === 0 && (
            <div className="border border-dashed border-slate-300 bg-white px-6 py-10">
              <h2 className="text-base font-semibold text-slate-900">
                {intel.hasCompletedScan
                  ? intel.status === "RUNNING"
                    ? "Advertising intelligence is being extracted…"
                    : "No products or services identified yet"
                  : "This site hasn't been scanned yet"}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                {intel.hasCompletedScan
                  ? intel.status === "RUNNING"
                    ? "The AI is reading your scan and identifying what you can advertise. This usually takes under a minute — refresh shortly."
                    : "Run the advertising analysis from the site's intelligence page to identify products and services."
                  : "Scan the site first — Ad Studio works from the products, services and images found on your website."}
              </p>
              <Link
                href={siteId ? `/sites/${siteId}/intelligence` : "/sites"}
                className="btn-primary mt-4 inline-block text-sm"
              >
                Open Site Intelligence
              </Link>
            </div>
          )}

          {intel && intel.offerings.length > 0 && (
            <section>
              <SectionLabel>What do you want to advertise?</SectionLabel>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {intel.offerings.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelected(o.id)}
                    className={cn(
                      "flex flex-col border bg-white p-5 text-left transition",
                      selected === o.id
                        ? "border-slate-900 ring-1 ring-slate-900"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {o.name}
                      </h3>
                      <span className="shrink-0 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {o.kind === "PRODUCT" ? "Product" : "Service"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
                      {o.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">
                        {o.price ?? ""}
                      </span>
                      {o.images.length > 0 && (
                        <span className="text-xs text-slate-400">
                          {o.images.length} image{o.images.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedOffering && (
            <section className="border border-slate-200 bg-white p-6 sm:p-8">
              <SectionLabel>Campaign brief</SectionLabel>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  {relatedOpportunity?.recommendedCampaign?.name ??
                    selectedOffering.name}
                </h2>
                {relatedOpportunity && (
                  <LevelBadge level={relatedOpportunity.level} />
                )}
              </div>
              {relatedOpportunity && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {relatedOpportunity.rationale}
                </p>
              )}
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Suggested goal
                  </dt>
                  <dd className="mt-1 text-slate-900">
                    {relatedOpportunity?.recommendedCampaign?.goal?.replaceAll("_", " ") ??
                      "Leads"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Suggested budget
                  </dt>
                  <dd className="mt-1 text-slate-900">
                    {relatedOpportunity?.recommendedCampaign?.budgetHint ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Landing page
                  </dt>
                  <dd className="mt-1 truncate text-slate-900">
                    {selectedOffering.url ?? "—"}
                  </dd>
                </div>
              </dl>
              {relatedOpportunity?.recommendedCampaign?.audience && (
                <p className="mt-4 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Audience: </span>
                  {relatedOpportunity.recommendedCampaign.audience}
                </p>
              )}
              {selectedOffering.images.length > 0 && (
                <div className="mt-5">
                  <SectionLabel>Available creative</SectionLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedOffering.images.map((img) => (
                      <Image
                        key={img.id}
                        src={img.url}
                        alt={img.alt ?? ""}
                        width={96}
                        height={64}
                        unoptimized
                        className="h-16 w-24 border border-slate-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled
                  className="btn-primary cursor-not-allowed text-sm opacity-60"
                >
                  Generate campaign with AI
                </button>
                <p className="text-xs text-slate-400">
                  The AI campaign builder — copy, keywords, creative and preview —
                  is the next milestone in this rollout.
                </p>
              </div>
            </section>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}

export default function AdStudioPage() {
  return (
    <Suspense>
      <AdStudioInner />
    </Suspense>
  );
}
