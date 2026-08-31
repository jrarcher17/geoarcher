"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  CampaignBuilder,
  type BuilderImage,
  type BuilderOffering,
  type BuilderOpportunity,
} from "@/components/ads/CampaignBuilder";
import { EmptyState, ErrorBanner, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/lib/useInsights";
import { cn, hostOf } from "@/lib/utils";

interface OfferingItem extends BuilderOffering {
  images: { id: string; url: string; alt: string | null }[];
}

interface OpportunityItem extends BuilderOpportunity {
  id: string;
  level: string;
  source?: string;
  details?: BuilderOpportunity["gap"];
  offering: { id: string; name: string; kind: string } | null;
}

interface Intelligence {
  siteUrl: string | null;
  status: string | null;
  hasCompletedScan: boolean;
  business: { companyName?: string } | null;
  offerings: OfferingItem[];
  images: BuilderImage[];
  opportunities: OpportunityItem[];
}

function AdStudioInner() {
  const params = useSearchParams();
  const { data: insights } = useInsights();
  const [siteId, setSiteId] = useState<string | null>(params.get("site"));
  const [selected, setSelected] = useState<string | null>(params.get("offering"));
  const prospectId = params.get("prospect");
  const opportunityId = params.get("opportunity");
  const initialAngle = params.get("angle");
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sites = useMemo(() => insights?.sites ?? [], [insights]);
  const siteUrl =
    sites.find((s) => s.siteId === siteId)?.url ?? intel?.siteUrl ?? "";

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

  useEffect(() => {
    if (selected || !intel || !opportunityId) return;
    const pinned = intel.opportunities.find((op) => op.id === opportunityId);
    if (pinned?.offering?.id) setSelected(pinned.offering.id);
  }, [intel, opportunityId, selected]);

  const selectedOffering = intel?.offerings.find((o) => o.id === selected) ?? null;
  const pinnedOpportunity =
    opportunityId && intel
      ? intel.opportunities.find((op) => op.id === opportunityId) ?? null
      : null;
  const relatedOpportunity =
    pinnedOpportunity ??
    intel?.opportunities.find(
      (op) => op.offering?.id === selected && op.source !== "COMPETITOR_GAP"
    ) ??
    null;

  return (
    <AppShell
      title="Ad Studio"
      subtitle="Original ads from your website. Competitor library ads inform patterns only — they are never copied."
    >
      {error && <ErrorBanner message={error} />}

      {insights && sites.length === 0 && !siteId && (
        <EmptyState
          title="Ad Studio needs a product"
          body="Add a product by scanning one webpage or entering it yourself, then generate ads from what it actually says."
          actionHref="/products"
          actionLabel="Add a product"
        />
      )}

      {(sites.length > 0 || siteId) && (
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
                Add a product from Products — scan one webpage or enter it
                yourself — then come back to generate ads.
              </p>
              <Link
                href="/products"
                className="btn-primary mt-4 inline-block text-sm"
              >
                Add a product
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

          {selectedOffering && siteId && intel && (
            <CampaignBuilder
              key={`${selectedOffering.id}-${relatedOpportunity?.id ?? "none"}`}
              siteId={siteId}
              siteUrl={siteUrl}
              businessName={
                intel.business?.companyName ?? (siteUrl ? hostOf(siteUrl) : "Business")
              }
              offering={selectedOffering}
              opportunity={
                relatedOpportunity
                  ? {
                      ...relatedOpportunity,
                      gap:
                        relatedOpportunity.gap ??
                        relatedOpportunity.details ??
                        null,
                    }
                  : null
              }
              images={intel.images}
              prospectId={prospectId}
              initialAngle={initialAngle}
            />
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
