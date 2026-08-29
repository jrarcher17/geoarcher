"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  CampaignStatusBadge,
  PlatformBadge,
} from "@/components/ads/primitives";
import { EmptyState, ErrorBanner, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatMoney, formatPercent } from "@/lib/advertising/format";
import { cn, hostOf } from "@/lib/utils";

interface AdRow {
  id: string;
  name: string | null;
  headline: string;
  body: string;
  creativeUrl: string | null;
  creativeAlt: string | null;
  creativeSource: string;
  version: number;
  createdAt: string;
  campaign: {
    id: string;
    name: string;
    platform: string;
    status: string;
    publishedAt: string | null;
  };
  offering: { id: string; name: string } | null;
  site: { id: string; url: string } | null;
  hasPerformance: boolean;
  metrics: {
    spendCents: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number | null;
  } | null;
}

const BUCKETS = [
  { id: "ALL", label: "All" },
  { id: "DRAFT", label: "Draft" },
  { id: "READY", label: "Ready" },
  { id: "PUBLISHED", label: "Published" },
  { id: "ARCHIVED", label: "Archived" },
] as const;

const PLATFORM_FILTERS = [
  { id: "ALL", label: "All platforms" },
  { id: "GOOGLE", label: "Google" },
  { id: "META", label: "Meta" },
  { id: "AI_CHAT", label: "ChatGPT" },
] as const;

type Bucket = (typeof BUCKETS)[number]["id"];
type PlatformFilter = (typeof PLATFORM_FILTERS)[number]["id"];

function inBucket(status: string, bucket: Bucket): boolean {
  if (bucket === "ALL") return true;
  if (bucket === "PUBLISHED") return status === "ACTIVE";
  return status === bucket;
}

function canArchive(status: string): boolean {
  return (
    status === "DRAFT" ||
    status === "READY" ||
    status === "PAUSED" ||
    status === "COMPLETED" ||
    status === "ERROR"
  );
}

function MyAdsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ads, setAds] = useState<AdRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [bucket, setBucket] = useState<Bucket>("ALL");
  const [platform, setPlatform] = useState<PlatformFilter>("ALL");
  const [productId, setProductId] = useState("ALL");
  const [campaignId, setCampaignId] = useState(
    searchParams.get("campaign") ?? "ALL"
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch("/api/me/ads", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          if (json.upgradeRequired) {
            setUpgrade(true);
            return null;
          }
          throw new Error(json.error ?? "Failed to load ads.");
        }
        return json;
      })
      .then((json) => {
        if (json) setAds(json.ads);
      });
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

  const products = useMemo(() => {
    if (!ads) return [];
    const seen = new Map<string, string>();
    for (const ad of ads) {
      if (ad.offering) seen.set(ad.offering.id, ad.offering.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [ads]);

  const campaigns = useMemo(() => {
    if (!ads) return [];
    const seen = new Map<string, string>();
    for (const ad of ads) seen.set(ad.campaign.id, ad.campaign.name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [ads]);

  const visible = useMemo(() => {
    if (!ads) return [];
    return ads.filter((ad) => {
      if (!inBucket(ad.campaign.status, bucket)) return false;
      if (platform !== "ALL" && ad.campaign.platform !== platform) return false;
      if (productId !== "ALL" && ad.offering?.id !== productId) return false;
      if (campaignId !== "ALL" && ad.campaign.id !== campaignId) return false;
      return true;
    });
  }, [ads, bucket, platform, productId, campaignId]);

  const counts = useMemo(() => {
    const list = ads ?? [];
    return {
      ALL: list.length,
      DRAFT: list.filter((a) => a.campaign.status === "DRAFT").length,
      READY: list.filter((a) => a.campaign.status === "READY").length,
      PUBLISHED: list.filter((a) => a.campaign.status === "ACTIVE").length,
      ARCHIVED: list.filter((a) => a.campaign.status === "ARCHIVED").length,
    };
  }, [ads]);

  async function setCampaignStatus(id: string, status: "ARCHIVED" | "DRAFT") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update the ad.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the ad.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      title="My Ads"
      subtitle="Every ad you created — copy, creative, and status. Performance appears only after an ad runs on a connected account."
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
      {upgrade && (
        <EmptyState
          title="Ad Studio is on Pro"
          body="Upgrade to save and manage generated ads."
          actionHref="/settings?tab=billing"
          actionLabel="Upgrade to Pro"
        />
      )}
      {!ads && !error && !upgrade && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      )}

      {ads && ads.length === 0 && (
        <EmptyState
          title="No ads yet"
          body="Create an ad from a product or opportunity. Nothing is published until you approve it."
          actionHref="/ad-studio"
          actionLabel="Open Ad Generator"
        />
      )}

      {ads && ads.length > 0 && (
        <FadeIn>
          <div className="mb-4 flex flex-wrap gap-2">
            {BUCKETS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBucket(b.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium",
                  bucket === b.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                )}
              >
                {b.label}
                <span className="ml-1.5 tabular-nums opacity-70">{counts[b.id]}</span>
              </button>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {PLATFORM_FILTERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium",
                  platform === p.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                )}
              >
                {p.label}
              </button>
            ))}
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              aria-label="Filter by product"
            >
              <option value="ALL">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              aria-label="Filter by campaign"
            >
              <option value="ALL">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <SectionLabel>
            {visible.length === 1 ? "1 ad" : `${visible.length} ads`}
          </SectionLabel>

          {visible.length === 0 ? (
            <p className="mt-4 border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
              No ads match these filters.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((ad) => (
                <article
                  key={ad.id}
                  className="flex flex-col border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/campaigns/${ad.campaign.id}`)}
                    className="text-left"
                  >
                    {ad.creativeUrl ? (
                      <div className="relative">
                        <Image
                          src={ad.creativeUrl}
                          alt={ad.creativeAlt ?? (ad.headline || ad.campaign.name)}
                          width={640}
                          height={360}
                          unoptimized
                          className="h-40 w-full border-b border-slate-100 bg-slate-50 object-cover"
                        />
                        {ad.creativeSource === "GENERATED" && (
                          <p className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            AI-generated concept
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-40 flex-col justify-end border-b border-slate-100 bg-slate-50 px-5 py-4">
                        <p className="line-clamp-3 text-base font-semibold leading-snug text-slate-800">
                          {ad.headline || ad.campaign.name}
                        </p>
                      </div>
                    )}
                    <div className="p-5 pb-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PlatformBadge platform={ad.campaign.platform} />
                        <CampaignStatusBadge status={ad.campaign.status} />
                      </div>
                      <h2 className="mt-3 text-base font-semibold text-slate-900">
                        {ad.headline || ad.name || ad.campaign.name}
                      </h2>
                      {ad.body && (
                        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-600">
                          {ad.body}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-slate-400">
                        {[
                          ad.offering?.name ?? "No product",
                          ad.campaign.name,
                          `Version ${ad.version}`,
                          new Date(ad.createdAt).toLocaleDateString(),
                          ad.site ? hostOf(ad.site.url) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {ad.hasPerformance && ad.metrics ? (
                        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <dt className="text-slate-400">Spend</dt>
                            <dd className="mt-0.5 tabular-nums text-slate-800">
                              {formatMoney(ad.metrics.spendCents)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">Impr.</dt>
                            <dd className="mt-0.5 tabular-nums text-slate-800">
                              {formatCount(ad.metrics.impressions)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">CTR</dt>
                            <dd className="mt-0.5 tabular-nums text-slate-800">
                              {formatPercent(ad.metrics.ctr)}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="mt-3 text-xs text-slate-400">
                          No performance yet
                          {ad.campaign.publishedAt
                            ? " — waiting for platform metrics."
                            : " — appears after the ad runs on a connected account."}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="mt-auto flex flex-wrap gap-2 p-5">
                    <Link
                      href={`/campaigns/${ad.campaign.id}`}
                      className="btn-secondary text-sm"
                    >
                      Open
                    </Link>
                    {canArchive(ad.campaign.status) && (
                      <button
                        type="button"
                        className="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                        disabled={busyId === ad.campaign.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void setCampaignStatus(ad.campaign.id, "ARCHIVED");
                        }}
                      >
                        {busyId === ad.campaign.id ? "Archiving…" : "Archive"}
                      </button>
                    )}
                    {ad.campaign.status === "ARCHIVED" && (
                      <button
                        type="button"
                        className="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                        disabled={busyId === ad.campaign.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void setCampaignStatus(ad.campaign.id, "DRAFT");
                        }}
                      >
                        {busyId === ad.campaign.id ? "Restoring…" : "Restore"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}

export default function MyAdsPage() {
  return (
    <Suspense>
      <MyAdsInner />
    </Suspense>
  );
}
