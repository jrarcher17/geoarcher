"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { ChannelChips, LevelBadge } from "@/components/ads/primitives";
import { SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/lib/useInsights";
import { hostOf } from "@/lib/utils";

interface Business {
  companyName?: string;
  brand?: string | null;
  description?: string;
  industry?: string;
  locations?: string[];
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface Marketing {
  headlines?: string[];
  valueProps?: string[];
  ctas?: string[];
  promotions?: string[];
  testimonials?: string[];
  trustSignals?: string[];
  usps?: string[];
}

interface OfferingItem {
  id: string;
  kind: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  price: string | null;
  url: string | null;
  details: {
    benefits?: string[];
    features?: string[];
    cta?: string | null;
    category?: string | null;
    targetAudience?: string[];
  } | null;
  images: { id: string; url: string; alt: string | null }[];
}

interface Intelligence {
  status: "RUNNING" | "COMPLETE" | "FAILED" | null;
  error: string | null;
  updatedAt: string | null;
  scanId: string | null;
  hasCompletedScan: boolean;
  business: Business | null;
  marketing: Marketing | null;
  offerings: OfferingItem[];
  images: { id: string; url: string; alt: string | null; pageUrl: string | null }[];
  opportunities: {
    id: string;
    title: string;
    level: string;
    rationale: string;
    channels: unknown;
    offering: { id: string; name: string; kind: string } | null;
  }[];
  competitors?: {
    id: string;
    name: string;
    source: string;
    category: string | null;
    offering: { id: string; name: string } | null;
  }[];
}

export default function SiteIntelligencePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const router = useRouter();
  const { data: insights } = useInsights();
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [showAllImages, setShowAllImages] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStarted = useRef(false);

  const site = insights?.sites.find((s) => s.siteId === siteId);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/intelligence`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Failed to load intelligence.");
      }
      const json: Intelligence = await res.json();
      setIntel(json);
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intelligence.");
      return null;
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while extraction runs.
  useEffect(() => {
    if (intel?.status !== "RUNNING") {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => void load(), 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [intel?.status, load]);

  const runAnalysis = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/intelligence`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Could not start the analysis.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the analysis.");
    } finally {
      setStarting(false);
    }
  }, [siteId, load]);

  // Older scans finished before advertising was part of the crawl. Start it
  // automatically instead of asking for a click.
  useEffect(() => {
    if (!intel || autoStarted.current) return;
    if (intel.hasCompletedScan && intel.status === null) {
      autoStarted.current = true;
      void runAnalysis();
    }
  }, [intel, runAnalysis]);

  async function scanAgain() {
    const scanId = intel?.scanId ?? site?.latestScan?.id;
    if (!scanId || rescanning) return;
    setRescanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/rescan`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.scanId) {
        router.push(`/scan/${data.scanId}`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not start a new scan.");
      router.push(`/scan/${data.scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a new scan.");
      setRescanning(false);
    }
  }

  const business = intel?.business;
  const marketing = intel?.marketing;
  const host = site ? hostOf(site.url) : "";
  const title = business?.companyName || host || "Site Intelligence";
  const running = intel?.status === "RUNNING";
  const awaitingAnalysis =
    starting ||
    running ||
    Boolean(intel?.hasCompletedScan && intel.status === null);
  const visibleImages = showAllImages ? intel?.images : intel?.images.slice(0, 12);

  return (
    <AppShell
      title={title}
      subtitle={site?.url}
      breadcrumb="Site Intelligence"
      live={awaitingAnalysis}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void scanAgain()}
            disabled={
              rescanning ||
              awaitingAnalysis ||
              !(intel?.scanId ?? site?.latestScan?.id)
            }
            className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rescanning ? "Starting…" : "Scan again"}
          </button>
          <button
            type="button"
            onClick={() => void runAnalysis()}
            disabled={awaitingAnalysis || !intel?.hasCompletedScan}
            className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {awaitingAnalysis ? "Analyzing…" : "Re-run advertising analysis"}
          </button>
        </div>
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!intel && !error && (
        <div className="grid gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {intel && !intel.hasCompletedScan && (
        <div className="border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Scan this site to build its advertising intelligence
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Add the URL from Sites. The scan crawls pages and builds advertising
            intelligence in one pass.
          </p>
          <Link href="/sites" className="btn-primary mt-6 inline-block">
            Go to Sites
          </Link>
        </div>
      )}

      {intel?.status === "FAILED" && (
        <div className="mb-6 border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          The last analysis failed{intel.error ? `: ${intel.error}` : "."} Try
          re-running it.
        </div>
      )}

      {awaitingAnalysis && !business && (
        <div className="border border-slate-200 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Reading your website…
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Identifying your business, products, services and campaign
            opportunities. This usually takes under a minute.
          </p>
        </div>
      )}

      {intel && business && (
        <FadeIn className="flex flex-col gap-8">
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border border-slate-200 bg-white p-6 sm:p-8">
              <SectionLabel>AI Business Profile</SectionLabel>
              <p className="mt-3 text-base leading-relaxed text-slate-700">
                {business.description}
              </p>
              <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                {business.brand && business.brand !== business.companyName && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Brand
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{business.brand}</dd>
                  </div>
                )}
                {business.industry && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Industry
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{business.industry}</dd>
                  </div>
                )}
                {(business.locations?.length ?? 0) > 0 && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Locations
                    </dt>
                    <dd className="mt-0.5 text-slate-900">
                      {business.locations!.join(", ")}
                    </dd>
                  </div>
                )}
                {business.phone && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Phone
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{business.phone}</dd>
                  </div>
                )}
                {business.email && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Email
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{business.email}</dd>
                  </div>
                )}
                {business.address && (
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Address
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{business.address}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Products &amp; Services
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                  {intel.offerings.length}
                </p>
                <p className="text-xs text-slate-400">identified on the website</p>
              </div>
              <div className="border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Website Images
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                  {intel.images.length}
                </p>
                <p className="text-xs text-slate-400">available as ad creative</p>
              </div>
              <div className="border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Advertising Opportunities
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                  {intel.opportunities.length}
                </p>
                <p className="text-xs text-slate-400">ranked by the AI</p>
              </div>
            </div>
          </section>

          {intel.opportunities.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <SectionLabel>Advertising opportunities</SectionLabel>
                  <p className="mt-2 text-sm text-slate-500">
                    Where this website can win customers with paid campaigns.
                  </p>
                </div>
                <Link
                  href={`/ad-studio?site=${siteId}`}
                  className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  Open Ad Studio
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {intel.opportunities.map((o) => (
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
                    <div className="mt-4">
                      <Link
                        href={`/ad-studio?site=${siteId}${o.offering ? `&offering=${o.offering.id}` : ""}`}
                        className="btn-primary text-sm"
                      >
                        Create Ad
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {intel.offerings.length > 0 && (
            <section>
              <SectionLabel>Products &amp; Services</SectionLabel>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {intel.offerings.map((o) => (
                  <article key={o.id} className="border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {o.name}
                      </h3>
                      <span className="shrink-0 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {o.kind === "PRODUCT" ? "Product" : "Service"}
                      </span>
                    </div>
                    {(o.details?.category ||
                      (o.details?.targetAudience?.length ?? 0) > 0) && (
                      <p className="mt-1 text-xs text-slate-400">
                        {[
                          o.details?.category,
                          ...(o.details?.targetAudience ?? []).slice(0, 2),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {o.description}
                    </p>
                    {(o.details?.benefits?.length ?? 0) > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-slate-600">
                        {o.details!.benefits!.slice(0, 4).map((b) => (
                          <li key={b} className="flex gap-2">
                            <span className="text-emerald-600">✓</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-sm">
                        <Link
                          href={`/products/${o.id}`}
                          className="text-xs font-medium text-slate-900 underline-offset-2 hover:underline"
                        >
                          Product intelligence
                        </Link>
                        {o.price && (
                          <span className="font-medium text-slate-900">{o.price}</span>
                        )}
                        {o.url && (
                          <a
                            href={o.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-400 underline-offset-2 hover:underline"
                          >
                            View page
                          </a>
                        )}
                      </div>
                      <Link
                        href={`/ad-studio?site=${siteId}&offering=${o.id}`}
                        className="btn-secondary text-sm"
                      >
                        Create Ad
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {(intel.competitors?.length ?? 0) > 0 && (
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
              <ul className="grid gap-3 sm:grid-cols-2">
                {intel.competitors!.map((c) => (
                  <li
                    key={c.id}
                    className="border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {c.source === "MANUAL"
                        ? "Added by you"
                        : c.source === "MENTIONED"
                          ? "Named on your site"
                          : "AI recommendation"}
                      {c.category ? ` · ${c.category}` : ""}
                      {c.offering ? ` · ${c.offering.name}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {intel.images.length > 0 && (
            <section>
              <SectionLabel>Website images</SectionLabel>
              <p className="mt-2 text-sm text-slate-500">
                Discovered on your website — selectable as ad creative in Ad Studio.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {visibleImages?.map((img) => (
                  <Image
                    key={img.id}
                    src={img.url}
                    alt={img.alt ?? ""}
                    width={200}
                    height={132}
                    unoptimized
                    className="h-24 w-full border border-slate-200 bg-slate-50 object-cover"
                  />
                ))}
              </div>
              {intel.images.length > 12 && (
                <button
                  type="button"
                  onClick={() => setShowAllImages((v) => !v)}
                  className="mt-3 text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  {showAllImages
                    ? "Show fewer"
                    : `Show all ${intel.images.length} images`}
                </button>
              )}
            </section>
          )}

          {marketing && (
            <section className="grid gap-4 lg:grid-cols-2">
              {(marketing.valueProps?.length ?? 0) > 0 && (
                <div className="border border-slate-200 bg-white p-5">
                  <SectionLabel>Value propositions</SectionLabel>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {marketing.valueProps!.slice(0, 6).map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(marketing.trustSignals?.length ?? 0) > 0 && (
                <div className="border border-slate-200 bg-white p-5">
                  <SectionLabel>Trust signals</SectionLabel>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {marketing.trustSignals!.slice(0, 6).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(marketing.testimonials?.length ?? 0) > 0 && (
                <div className="border border-slate-200 bg-white p-5">
                  <SectionLabel>Testimonials found</SectionLabel>
                  <ul className="mt-3 space-y-3 text-sm italic text-slate-600">
                    {marketing.testimonials!.slice(0, 3).map((t) => (
                      <li key={t}>&ldquo;{t}&rdquo;</li>
                    ))}
                  </ul>
                </div>
              )}
              {(marketing.promotions?.length ?? 0) > 0 && (
                <div className="border border-slate-200 bg-white p-5">
                  <SectionLabel>Active promotions</SectionLabel>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {marketing.promotions!.slice(0, 4).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}
