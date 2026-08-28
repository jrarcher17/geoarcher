"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  CampaignStatusBadge,
  PlatformBadge,
} from "@/components/ads/primitives";
import { EmptyState } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatRoas,
} from "@/lib/advertising/format";
import { cn, hostOf } from "@/lib/utils";

interface CampaignRow {
  id: string;
  name: string;
  platform: string;
  status: string;
  goal: string;
  budgetDailyCents: number | null;
  site: { id: string; url: string } | null;
  offering: { id: string; name: string } | null;
  ads: number;
  createdAt: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpcCents: number | null;
  conversions: number;
  cpaCents: number | null;
  revenueCents: number;
  roas: number | null;
}

const STATUS_FILTERS = [
  "ALL",
  "DRAFT",
  "READY",
  "PENDING_APPROVAL",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ERROR",
] as const;

const PLATFORM_FILTERS = ["ALL", "GOOGLE", "META"] as const;

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [platform, setPlatform] = useState<(typeof PLATFORM_FILTERS)[number]>("ALL");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaigns", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          if (json.upgradeRequired) {
            if (!cancelled) setUpgrade(true);
            return null;
          }
          throw new Error(json.error ?? "Failed to load campaigns.");
        }
        return json;
      })
      .then((json) => {
        if (!cancelled && json) setCampaigns(json.campaigns);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load campaigns.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!campaigns) return [];
    return campaigns.filter(
      (c) =>
        (status === "ALL" || c.status === status) &&
        (platform === "ALL" || c.platform === platform)
    );
  }, [campaigns, status, platform]);

  return (
    <AppShell
      title="Campaigns"
      subtitle="Every advertising campaign across Google and Meta — spend, results and status in one place."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {upgrade && (
        <EmptyState
          title="Campaigns are a Pro feature"
          body="Upgrade to Pro to create AI-generated advertising campaigns from your website intelligence and manage them here."
          actionHref="/settings?tab=billing"
          actionLabel="Upgrade to Pro"
        />
      )}

      {!campaigns && !error && !upgrade && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {campaigns && campaigns.length === 0 && (
        <EmptyState
          title="No campaigns yet"
          body="Create your first campaign in Ad Studio. Pick a product or service from your website intelligence and AI drafts the ads."
          actionHref="/ad-studio"
          actionLabel="Open Ad Studio"
        />
      )}

      {campaigns && campaigns.length > 0 && (
        <FadeIn className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium",
                    status === s
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-500 hover:text-slate-800"
                  )}
                >
                  {s === "ALL" ? "All" : s.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {PLATFORM_FILTERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium",
                    platform === p
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-500 hover:text-slate-800"
                  )}
                >
                  {p === "ALL" ? "All platforms" : p === "GOOGLE" ? "Google" : "Meta"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 bg-white">
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">Impr.</th>
                  <th className="px-4 py-3 text-right">Clicks</th>
                  <th className="px-4 py-3 text-right">CTR</th>
                  <th className="px-4 py-3 text-right">CPC</th>
                  <th className="px-4 py-3 text-right">Conv.</th>
                  <th className="px-4 py-3 text-right">CPA</th>
                  <th className="px-4 py-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 last:border-0"
                    onClick={() => router.push(`/campaigns/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 underline-offset-2 hover:underline">
                        {c.name}
                      </p>
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
                      {formatCount(c.impressions)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCount(c.clicks)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPercent(c.ctr)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(c.cpcCents)}
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                      No campaigns match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            Draft campaigns don&apos;t spend money. Metrics appear after a campaign is
            published to a connected ad account.{" "}
            <Link href="/integrations" className="underline underline-offset-2">
              Manage connections
            </Link>
          </p>
        </FadeIn>
      )}
    </AppShell>
  );
}
