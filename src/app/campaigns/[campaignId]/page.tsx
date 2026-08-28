"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  CampaignStatusBadge,
  KpiCard,
  PlatformBadge,
} from "@/components/ads/primitives";
import { GoogleAdPreview, MetaAdPreview } from "@/components/ads/previews";
import { SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatRoas,
} from "@/lib/advertising/format";
import { hostOf } from "@/lib/utils";

interface AdCopy {
  headlines?: string[];
  descriptions?: string[];
  primaryText?: string;
  cta?: string;
  keywords?: string[];
}

interface CampaignDetail {
  id: string;
  name: string;
  platform: string;
  status: string;
  goal: string;
  landingPage: string | null;
  budgetDailyCents: number | null;
  locations: { name?: string }[];
  audience: { description?: string } | null;
  structure: { adGroupName?: string; adSetName?: string; cta?: string } | null;
  error: string | null;
  createdAt: string;
  publishedAt: string | null;
  site: { id: string; url: string } | null;
  businessName: string | null;
  offering: { id: string; name: string; kind: string } | null;
  ads: {
    id: string;
    name: string | null;
    copy: AdCopy;
    destinationUrl: string | null;
    creativeSource: string;
    creative: { url?: string; alt?: string | null } | null;
  }[];
  metrics: {
    spendCents: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenueCents: number;
    ctr: number | null;
    cpcCents: number | null;
    cpaCents: number | null;
    roas: number | null;
  };
}

interface ConnectionInfo {
  connected: boolean;
  accountName: string | null;
  canPublish: boolean;
  blockedReason: string | null;
}

const GOAL_LABELS: Record<string, string> = {
  LEADS: "Leads",
  SALES: "Sales",
  TRAFFIC: "Website Traffic",
  PHONE_CALLS: "Phone Calls",
  AWARENESS: "Awareness",
};

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load the campaign.");
    setCampaign(json.campaign);
    setConnection(json.connection ?? null);
  }, [campaignId]);

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load the campaign.")
    );
  }, [load]);

  async function changeStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      setCampaign(json.campaign);
      if (json.connection) setConnection(json.connection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/publish`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Publish failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this campaign and its ads? This can't be undone.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setBusy(false);
    }
  }

  const c = campaign;
  const locations = (c?.locations ?? [])
    .map((l) => l?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <AppShell title="Campaigns" subtitle="Campaign detail">
      <Link
        href="/campaigns"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> All campaigns
      </Link>

      {error && (
        <p className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!c && !error && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      )}

      {c && (
        <FadeIn className="flex flex-col gap-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {c.name}
                </h1>
                <PlatformBadge platform={c.platform} />
                <CampaignStatusBadge status={c.status} />
              </div>
              <p className="mt-1.5 text-sm text-slate-500">
                {[
                  c.site ? hostOf(c.site.url) : null,
                  c.offering?.name,
                  GOAL_LABELS[c.goal] ?? c.goal,
                  `Created ${new Date(c.createdAt).toLocaleDateString()}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {c.error && (
                <p className="mt-2 text-sm text-red-600">Platform error: {c.error}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {c.status === "DRAFT" && (
                <button
                  type="button"
                  className="btn-primary text-sm disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void changeStatus("READY")}
                >
                  Approve — mark Ready
                </button>
              )}
              {c.status === "READY" && (
                <>
                  {connection?.canPublish ? (
                    <button
                      type="button"
                      className="btn-primary text-sm disabled:opacity-60"
                      disabled={busy}
                      onClick={() => void handlePublish()}
                    >
                      {busy ? "Publishing…" : "Publish"}
                    </button>
                  ) : (
                    <span
                      className="cursor-not-allowed bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
                      title={connection?.blockedReason ?? "Connect an ad account in Integrations to publish"}
                    >
                      Publish
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-secondary text-sm disabled:opacity-60"
                    disabled={busy}
                    onClick={() => void changeStatus("DRAFT")}
                  >
                    Back to Draft
                  </button>
                </>
              )}
              {c.status === "ACTIVE" && (
                <button
                  type="button"
                  className="btn-secondary text-sm disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void changeStatus("PAUSED")}
                >
                  Pause
                </button>
              )}
              {c.status === "PAUSED" && (
                <button
                  type="button"
                  className="btn-primary text-sm disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void changeStatus("ACTIVE")}
                >
                  Resume
                </button>
              )}
              {c.status === "ERROR" && (
                <button
                  type="button"
                  className="btn-secondary text-sm disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void changeStatus("DRAFT")}
                >
                  Back to Draft
                </button>
              )}
              {c.status !== "ACTIVE" && (
                <button
                  type="button"
                  className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void handleDelete()}
                >
                  Delete
                </button>
              )}
            </div>
            {c.status === "READY" && connection && !connection.canPublish && (
              <p className="w-full text-sm text-slate-500">
                {connection.blockedReason}{" "}
                <Link href="/integrations" className="underline underline-offset-2">
                  Open Integrations
                </Link>
              </p>
            )}
          </header>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Spend" value={formatMoney(c.metrics.spendCents)} />
            <KpiCard label="Impressions" value={formatCount(c.metrics.impressions)} />
            <KpiCard label="Clicks" value={formatCount(c.metrics.clicks)} />
            <KpiCard label="CTR" value={formatPercent(c.metrics.ctr)} />
            <KpiCard label="CPC" value={formatMoney(c.metrics.cpcCents)} />
            <KpiCard label="Conversions" value={formatCount(c.metrics.conversions)} />
            <KpiCard label="CPA" value={formatMoney(c.metrics.cpaCents)} />
            <KpiCard label="ROAS" value={formatRoas(c.metrics.roas)} />
          </section>
          {c.metrics.impressions === 0 && (
            <p className="-mt-5 text-xs text-slate-400">
              No performance data yet — metrics appear once the campaign runs on a
              connected ad account.
            </p>
          )}

          <section className="border border-slate-200 bg-white p-6">
            <SectionLabel>Campaign settings</SectionLabel>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                  Daily budget
                </dt>
                <dd className="mt-0.5 text-slate-900">
                  {c.budgetDailyCents ? `${formatMoney(c.budgetDailyCents)}/day` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                  Locations
                </dt>
                <dd className="mt-0.5 text-slate-900">
                  {locations.length > 0 ? locations.join(", ") : "Everywhere"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                  Landing page
                </dt>
                <dd className="mt-0.5 truncate text-slate-900">
                  {c.landingPage ?? "—"}
                </dd>
              </div>
              {c.audience?.description && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                    Audience
                  </dt>
                  <dd className="mt-0.5 text-slate-900">{c.audience.description}</dd>
                </div>
              )}
            </dl>
          </section>

          {c.ads.map((ad) => (
            <section key={ad.id} className="border border-slate-200 bg-white p-6">
              <SectionLabel>
                {c.platform === "GOOGLE"
                  ? `Ad group — ${c.structure?.adGroupName ?? ad.name ?? c.name}`
                  : `Ad set — ${c.structure?.adSetName ?? ad.name ?? c.name}`}
              </SectionLabel>

              <div className="mt-4 grid gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-5 text-sm">
                  {c.platform === "GOOGLE" && (
                    <>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Headlines ({ad.copy.headlines?.length ?? 0})
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {(ad.copy.headlines ?? []).map((h) => (
                            <li key={h} className="bg-slate-50 px-2.5 py-1 text-slate-800">
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Descriptions
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {(ad.copy.descriptions ?? []).map((d) => (
                            <li key={d} className="bg-slate-50 px-2.5 py-1.5 text-slate-800">
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Keywords ({ad.copy.keywords?.length ?? 0})
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {(ad.copy.keywords ?? []).map((k) => (
                            <li
                              key={k}
                              className="border border-slate-200 px-2 py-0.5 text-xs text-slate-600"
                            >
                              {k}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                  {c.platform === "META" && (
                    <>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Primary text
                        </p>
                        <p className="whitespace-pre-line bg-slate-50 px-3 py-2 leading-relaxed text-slate-800">
                          {ad.copy.primaryText}
                        </p>
                      </div>
                      <dl className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                            Headline
                          </dt>
                          <dd className="mt-0.5 text-slate-900">
                            {ad.copy.headlines?.[0] ?? "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                            Description
                          </dt>
                          <dd className="mt-0.5 text-slate-900">
                            {ad.copy.descriptions?.[0] ?? "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                            CTA
                          </dt>
                          <dd className="mt-0.5 text-slate-900">
                            {(ad.copy.cta ?? "LEARN_MORE").replaceAll("_", " ").toLowerCase()}
                          </dd>
                        </div>
                      </dl>
                    </>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Preview
                  </p>
                  {c.platform === "GOOGLE" ? (
                    <GoogleAdPreview
                      headlines={ad.copy.headlines ?? []}
                      descriptions={ad.copy.descriptions ?? []}
                      landingPage={ad.destinationUrl ?? c.landingPage ?? ""}
                    />
                  ) : (
                    <MetaAdPreview
                      businessName={
                        c.businessName ?? (c.site ? hostOf(c.site.url) : "Your business")
                      }
                      primaryText={ad.copy.primaryText ?? ""}
                      headline={ad.copy.headlines?.[0] ?? ""}
                      description={ad.copy.descriptions?.[0] ?? ""}
                      cta={ad.copy.cta ?? "LEARN_MORE"}
                      imageUrl={ad.creative?.url ?? null}
                      landingPage={ad.destinationUrl ?? c.landingPage ?? ""}
                    />
                  )}
                </div>
              </div>
            </section>
          ))}
        </FadeIn>
      )}
    </AppShell>
  );
}
