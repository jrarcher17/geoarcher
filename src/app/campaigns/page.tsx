"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  CampaignStatusBadge,
  PlatformBadge,
} from "@/components/ads/primitives";
import { EmptyState, ErrorBanner, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCount,
  formatMoney,
  formatPercent,
} from "@/lib/advertising/format";
import { cn, hostOf } from "@/lib/utils";

interface CampaignRow {
  id: string;
  name: string;
  platform: string;
  status: string;
  goal: string;
  budgetDailyCents: number | null;
  landingPage: string | null;
  audience: string | null;
  familyId: string | null;
  publishedAt: string | null;
  site: { id: string; url: string } | null;
  offering: { id: string; name: string } | null;
  ads: number;
  createdAt: string;
  hasPerformance: boolean;
  spendCents: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
}

interface CampaignCard {
  key: string;
  name: string;
  offering: { id: string; name: string } | null;
  audience: string | null;
  goal: string;
  landingPage: string | null;
  site: { id: string; url: string } | null;
  budgetDailyCents: number | null;
  budgetVaries: boolean;
  ads: number;
  createdAt: string;
  platforms: string[];
  statuses: string[];
  members: CampaignRow[];
  href: string;
  hasPerformance: boolean;
  spendCents: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
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

const GOAL_LABELS: Record<string, string> = {
  LEADS: "Leads",
  SALES: "Sales",
  TRAFFIC: "Website Traffic",
  PHONE_CALLS: "Phone Calls",
  AWARENESS: "Awareness",
};

const PLATFORM_ORDER = ["GOOGLE", "META", "AI_CHAT"];

type Bucket = (typeof BUCKETS)[number]["id"];
type PlatformFilter = (typeof PLATFORM_FILTERS)[number]["id"];

function inBucket(status: string, bucket: Bucket): boolean {
  if (bucket === "ALL") return true;
  if (bucket === "PUBLISHED") return status === "ACTIVE";
  return status === bucket;
}

function pickHref(members: CampaignRow[]): string {
  const rank = (s: string) =>
    s === "ACTIVE" ? 0 : s === "READY" ? 1 : s === "PAUSED" ? 2 : 3;
  const chosen = [...members].sort((a, b) => rank(a.status) - rank(b.status))[0];
  return `/campaigns/${chosen.id}`;
}

function toCard(members: CampaignRow[]): CampaignCard {
  const first = members[0];
  const budgets = [
    ...new Set(members.map((m) => m.budgetDailyCents).filter((n): n is number => n != null)),
  ];
  const live = members.filter((m) => m.hasPerformance);
  const impressions = live.reduce((n, m) => n + m.impressions, 0);
  const clicks = live.reduce((n, m) => n + m.clicks, 0);
  const spendCents = live.reduce((n, m) => n + m.spendCents, 0);
  return {
    key: first.familyId ?? first.id,
    name: first.name,
    offering: first.offering,
    audience: members.find((m) => m.audience)?.audience ?? null,
    goal: first.goal,
    landingPage: first.landingPage,
    site: first.site,
    budgetDailyCents: budgets[0] ?? null,
    budgetVaries: budgets.length > 1,
    ads: members.reduce((n, m) => n + m.ads, 0),
    createdAt: first.createdAt,
    platforms: [...new Set(members.map((m) => m.platform))].sort(
      (a, b) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b)
    ),
    statuses: [...new Set(members.map((m) => m.status))],
    members,
    href: pickHref(members),
    hasPerformance: live.length > 0,
    spendCents,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : null,
  };
}

function groupCampaigns(rows: CampaignRow[]): CampaignCard[] {
  const families = new Map<string, CampaignRow[]>();
  const singles: CampaignRow[] = [];
  for (const row of rows) {
    if (row.familyId) {
      const list = families.get(row.familyId) ?? [];
      list.push(row);
      families.set(row.familyId, list);
    } else {
      singles.push(row);
    }
  }
  return [...families.values(), ...singles.map((row) => [row])]
    .map(toCard)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [bucket, setBucket] = useState<Bucket>("ALL");
  const [platform, setPlatform] = useState<PlatformFilter>("ALL");
  const [productId, setProductId] = useState("ALL");

  const load = useCallback(() => {
    return fetch("/api/campaigns", { cache: "no-store" }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) {
        if (json.upgradeRequired) {
          setUpgrade(true);
          return;
        }
        throw new Error(json.error ?? "Failed to load campaigns.");
      }
      setCampaigns(json.campaigns);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((err) => {
      if (!cancelled)
        setError(err instanceof Error ? err.message : "Failed to load campaigns.");
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const products = useMemo(() => {
    if (!campaigns) return [];
    const seen = new Map<string, string>();
    for (const c of campaigns) {
      if (c.offering) seen.set(c.offering.id, c.offering.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [campaigns]);

  const cards = useMemo(() => {
    if (!campaigns) return [];
    const visible = campaigns.filter((c) => {
      if (!inBucket(c.status, bucket)) return false;
      if (platform !== "ALL" && c.platform !== platform) return false;
      if (productId !== "ALL" && c.offering?.id !== productId) return false;
      return true;
    });
    return groupCampaigns(visible);
  }, [campaigns, bucket, platform, productId]);

  const counts = useMemo(() => {
    const list = campaigns ?? [];
    return {
      ALL: groupCampaigns(list).length,
      DRAFT: groupCampaigns(list.filter((c) => c.status === "DRAFT")).length,
      READY: groupCampaigns(list.filter((c) => c.status === "READY")).length,
      PUBLISHED: groupCampaigns(list.filter((c) => c.status === "ACTIVE")).length,
      ARCHIVED: groupCampaigns(list.filter((c) => c.status === "ARCHIVED")).length,
    };
  }, [campaigns]);

  return (
    <AppShell
      title="Campaigns"
      subtitle="Product, audience, platform, and status for every campaign you created. Performance appears only after a campaign runs on a connected account."
    >
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            setError(null);
            void load().catch((err) =>
              setError(err instanceof Error ? err.message : "Failed to load campaigns.")
            );
          }}
        />
      )}

      {upgrade && (
        <EmptyState
          title="Campaigns are a Pro feature"
          body="Upgrade to Pro to create AI-generated advertising campaigns from your website intelligence and manage them here."
          actionHref="/settings?tab=billing"
          actionLabel="Upgrade to Pro"
        />
      )}

      {!campaigns && !error && !upgrade && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      )}

      {campaigns && campaigns.length === 0 && (
        <EmptyState
          title="No campaigns yet"
          body="Create your first campaign in Ad Generator. Pick a product or service from your website intelligence and AI drafts the ads."
          actionHref="/ad-studio"
          actionLabel="Open Ad Generator"
        />
      )}

      {campaigns && campaigns.length > 0 && (
        <FadeIn className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
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
            <Link href="/ad-studio" className="btn-primary text-sm">
              Create campaign
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
          </div>

          <SectionLabel>
            {cards.length === 1 ? "1 campaign" : `${cards.length} campaigns`}
          </SectionLabel>

          {cards.length === 0 ? (
            <p className="border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
              No campaigns match these filters.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {cards.map((card) => (
                <article
                  key={card.key}
                  className="flex flex-col border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                      {card.offering
                        ? `${card.offering.name} — ${card.name}`
                        : card.name}
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {card.statuses.map((s) => (
                        <CampaignStatusBadge key={s} status={s} />
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {card.platforms.map((p) => (
                      <PlatformBadge key={p} platform={p} />
                    ))}
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                        Product
                      </dt>
                      <dd className="mt-0.5 text-slate-800">
                        {card.offering?.name ?? "No product"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                        Objective
                      </dt>
                      <dd className="mt-0.5 text-slate-800">
                        {GOAL_LABELS[card.goal] ?? card.goal}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                        Budget
                      </dt>
                      <dd className="mt-0.5 text-slate-800">
                        {card.budgetVaries
                          ? "Varies by platform"
                          : card.budgetDailyCents
                            ? `${formatMoney(card.budgetDailyCents)}/day`
                            : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                        Ads
                      </dt>
                      <dd className="mt-0.5 text-slate-800">
                        {card.ads} ad{card.ads === 1 ? "" : "s"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                        Landing page
                      </dt>
                      <dd className="mt-0.5 truncate text-slate-800">
                        {card.landingPage
                          ? hostOf(card.landingPage)
                          : card.site
                            ? hostOf(card.site.url)
                            : "—"}
                      </dd>
                    </div>
                    {card.audience && (
                      <div className="sm:col-span-2">
                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                          Audience
                        </dt>
                        <dd className="mt-0.5 line-clamp-2 text-slate-800">
                          {card.audience}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {card.hasPerformance ? (
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-slate-400">Spend</dt>
                        <dd className="mt-0.5 tabular-nums text-slate-800">
                          {formatMoney(card.spendCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Impr.</dt>
                        <dd className="mt-0.5 tabular-nums text-slate-800">
                          {formatCount(card.impressions)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">CTR</dt>
                        <dd className="mt-0.5 tabular-nums text-slate-800">
                          {formatPercent(card.ctr)}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-4 text-xs text-slate-400">
                      No performance yet — appears after the campaign runs on a
                      connected account.
                    </p>
                  )}

                  <p className="mt-3 text-xs text-slate-400">
                    Created {new Date(card.createdAt).toLocaleDateString()}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => router.push(card.href)}
                    >
                      View campaign
                    </button>
                    {card.members.length === 1 && (
                      <Link
                        href={`/ads?campaign=${card.members[0].id}`}
                        className="btn-secondary text-sm"
                      >
                        View ads
                      </Link>
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
