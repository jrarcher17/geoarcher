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
import {
  CampaignEditForm,
  type CampaignEditPayload,
} from "@/components/ads/CampaignEditForm";
import { AiAdPreview, GoogleAdPreview, MetaAdPreview } from "@/components/ads/previews";
import { ErrorBanner, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatRoas,
} from "@/lib/advertising/format";
import { hostOf } from "@/lib/utils";

interface PmaxConcept {
  theme?: string;
  headlines?: string[];
  descriptions?: string[];
  audience?: string;
}

interface AdCopy {
  headlines?: string[];
  descriptions?: string[];
  primaryText?: string;
  cta?: string;
  keywords?: string[];
  negativeKeywords?: string[];
  path1?: string;
  path2?: string;
  pmaxConcepts?: PmaxConcept[];
  advertiser?: string;
  headline?: string;
  description?: string;
  prompt?: string;
  answer?: string;
  followUp?: string | null;
  intents?: string[];
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
  familyId: string | null;
  site: { id: string; url: string } | null;
  businessName: string | null;
  offering: { id: string; name: string; kind: string } | null;
  siblings: { id: string; platform: string; status: string }[];
  hasPerformance: boolean;
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
  const [metaFormat, setMetaFormat] = useState<"feed" | "story">("feed");
  const [editing, setEditing] = useState(false);

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

  async function saveEdits(payload: CampaignEditPayload) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      setCampaign(json.campaign);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
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
    <AppShell
      title={c?.name ?? "Campaigns"}
      subtitle={
        c
          ? [GOAL_LABELS[c.goal] ?? c.goal, c.offering?.name]
              .filter(Boolean)
              .join(" · ")
          : "Campaign detail"
      }
    >
      <Link
        href="/campaigns"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> All campaigns
      </Link>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            setError(null);
            void load().catch((err) =>
              setError(err instanceof Error ? err.message : "Failed to load the campaign.")
            );
          }}
        />
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
              {(c.siblings ?? []).length > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.siblings.map((s) => (
                    <Link
                      key={s.id}
                      href={`/campaigns/${s.id}`}
                      className={
                        s.id === c.id
                          ? "bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                          : "border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                      }
                    >
                      {s.platform === "GOOGLE"
                        ? "Google"
                        : s.platform === "META"
                          ? "Meta"
                          : "ChatGPT"}
                    </Link>
                  ))}
                </div>
              )}
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
              {c.status === "ARCHIVED" && (
                <button
                  type="button"
                  className="btn-secondary text-sm disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void changeStatus("DRAFT")}
                >
                  Restore to Draft
                </button>
              )}
              {(c.status === "DRAFT" ||
                c.status === "READY" ||
                c.status === "PAUSED" ||
                c.status === "COMPLETED" ||
                c.status === "ERROR") && (
                <button
                  type="button"
                  className="btn-secondary text-sm disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void changeStatus("ARCHIVED")}
                >
                  Archive
                </button>
              )}
              <button
                type="button"
                className="btn-secondary text-sm disabled:opacity-60"
                disabled={busy}
                onClick={() => setEditing((on) => !on)}
              >
                {editing ? "Cancel" : "Edit"}
              </button>
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
              {c.offering && c.site && (
                <Link
                  href={`/ad-studio?site=${c.site.id}&offering=${c.offering.id}`}
                  className="btn-secondary text-sm"
                >
                  Create another ad
                </Link>
              )}
              <Link href={`/ads?campaign=${c.id}`} className="btn-secondary text-sm">
                View in My Ads
              </Link>
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

          {c.hasPerformance ? (
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
          ) : (
            <p className="border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              No performance yet — metrics appear once the campaign runs on a
              connected ad account.
            </p>
          )}

          {editing && (
            <CampaignEditForm
              platform={c.platform}
              name={c.name}
              budgetDailyCents={c.budgetDailyCents}
              landingPage={c.landingPage}
              offering={c.offering}
              siteId={c.site?.id ?? null}
              published={Boolean(c.publishedAt)}
              creative={c.ads[0]?.creative ?? null}
              copy={c.ads[0]?.copy ?? {}}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={(payload) => void saveEdits(payload)}
            />
          )}

          <section className="border border-slate-200 bg-white p-6">
            <SectionLabel>Campaign</SectionLabel>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                  Product
                </dt>
                <dd className="mt-0.5 text-slate-900">
                  {c.offering?.name ?? "No product"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                  Objective
                </dt>
                <dd className="mt-0.5 text-slate-900">
                  {GOAL_LABELS[c.goal] ?? c.goal}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                  Platform
                </dt>
                <dd className="mt-0.5 text-slate-900">
                  {c.platform === "GOOGLE"
                    ? "Google"
                    : c.platform === "META"
                      ? "Meta"
                      : "ChatGPT"}
                </dd>
              </div>
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
                  Ads
                </dt>
                <dd className="mt-0.5 text-slate-900">
                  {c.ads.length} ad{c.ads.length === 1 ? "" : "s"}
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
                  : c.platform === "META"
                    ? `Ad set — ${c.structure?.adSetName ?? ad.name ?? c.name}`
                    : "Recommended answer — not a live placement"}
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
                          Display URL
                        </p>
                        <p className="text-slate-800">
                          {hostOf(ad.destinationUrl ?? c.landingPage ?? "")}
                          {ad.copy.path1 ? `/${ad.copy.path1}` : ""}
                          {ad.copy.path2 ? `/${ad.copy.path2}` : ""}
                        </p>
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
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Negative keywords ({ad.copy.negativeKeywords?.length ?? 0})
                        </p>
                        {(ad.copy.negativeKeywords ?? []).length === 0 ? (
                          <p className="text-xs text-slate-400">None saved.</p>
                        ) : (
                          <ul className="flex flex-wrap gap-1.5">
                            {(ad.copy.negativeKeywords ?? []).map((k) => (
                              <li
                                key={k}
                                className="border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500"
                              >
                                {k}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {(ad.copy.pmaxConcepts ?? []).length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Performance Max concepts
                          </p>
                          <p className="mb-2 text-xs text-slate-400">
                            Planning concepts only — not a live campaign.
                          </p>
                          <div className="flex flex-col gap-2">
                            {(ad.copy.pmaxConcepts ?? []).map((concept, i) => (
                              <div
                                key={`${concept.theme ?? "pmax"}-${i}`}
                                className="border border-slate-100 bg-slate-50 p-3"
                              >
                                <p className="font-medium text-slate-900">
                                  {concept.theme || `Concept ${i + 1}`}
                                </p>
                                {concept.audience && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {concept.audience}
                                  </p>
                                )}
                                <ul className="mt-2 flex flex-wrap gap-1.5">
                                  {(concept.headlines ?? []).map((h) => (
                                    <li
                                      key={h}
                                      className="bg-white px-2 py-0.5 text-xs text-slate-700"
                                    >
                                      {h}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {c.platform === "AI_CHAT" && (
                    <>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                            Advertiser
                          </dt>
                          <dd className="mt-0.5 text-slate-900">
                            {ad.copy.advertiser || c.businessName || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                            Headline
                          </dt>
                          <dd className="mt-0.5 text-slate-900">
                            {ad.copy.headline || "—"}
                          </dd>
                        </div>
                      </dl>
                      {ad.copy.description && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Description
                          </p>
                          <p className="bg-slate-50 px-3 py-2 leading-relaxed text-slate-800">
                            {ad.copy.description}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Buyer prompt
                        </p>
                        <p className="bg-slate-50 px-3 py-2 text-slate-800">
                          {ad.copy.prompt || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Recommended answer
                        </p>
                        <p className="whitespace-pre-line bg-slate-50 px-3 py-2 leading-relaxed text-slate-800">
                          {ad.copy.answer || "—"}
                        </p>
                      </div>
                      {ad.copy.followUp && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Follow-up
                          </p>
                          <p className="text-slate-800">{ad.copy.followUp}</p>
                        </div>
                      )}
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Intent / context ({ad.copy.intents?.length ?? 0})
                        </p>
                        {(ad.copy.intents ?? []).length === 0 ? (
                          <p className="text-xs text-slate-400">None saved.</p>
                        ) : (
                          <ul className="flex flex-wrap gap-1.5">
                            {(ad.copy.intents ?? []).map((intent) => (
                              <li
                                key={intent}
                                className="border border-slate-200 px-2 py-0.5 text-xs text-slate-600"
                              >
                                {intent}
                              </li>
                            ))}
                          </ul>
                        )}
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
                  {c.platform === "AI_CHAT" ? (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => {
                            const text = [
                              `Platform: ChatGPT`,
                              `Note: Headline and description publish as the chat card.`,
                              `Advertiser: ${ad.copy.advertiser ?? c.businessName ?? ""}`,
                              `Headline: ${ad.copy.headline ?? ""}`,
                              `Description: ${ad.copy.description ?? ""}`,
                              `Landing page: ${ad.destinationUrl ?? c.landingPage ?? ""}`,
                              ``,
                              `Buyer prompt:`,
                              ad.copy.prompt ?? "",
                              ``,
                              `Recommended answer:`,
                              ad.copy.answer ?? "",
                              ``,
                              `Follow-up: ${ad.copy.followUp ?? ""}`,
                              ``,
                              `Intent / context:`,
                              ...(ad.copy.intents ?? []).map((intent) => `- ${intent}`),
                            ].join("\n");
                            const blob = new Blob([text], { type: "text/plain" });
                            const href = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = href;
                            a.download = `${c.name.replace(/\s+/g, "-").toLowerCase()}-chatgpt.txt`;
                            a.click();
                            URL.revokeObjectURL(href);
                          }}
                        >
                          Export
                        </button>
                      </div>
                      <AiAdPreview
                        advertiser={
                          ad.copy.advertiser ||
                          c.businessName ||
                          (c.site ? hostOf(c.site.url) : "Your business")
                        }
                        headline={ad.copy.headline}
                        description={ad.copy.description}
                        prompt={ad.copy.prompt}
                        answer={ad.copy.answer}
                        followUp={ad.copy.followUp}
                        landingPage={ad.destinationUrl ?? c.landingPage ?? ""}
                        intents={ad.copy.intents}
                        imageUrl={ad.creative?.url ?? null}
                        imageLabel={
                          ad.creativeSource === "GENERATED"
                            ? ad.creative?.alt ??
                              "AI-generated concept — not a website photo"
                            : null
                        }
                      />
                    </div>
                  ) : c.platform === "GOOGLE" ? (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => {
                            const text = [
                              `Platform: Google`,
                              `Display URL: ${hostOf(ad.destinationUrl ?? c.landingPage ?? "")}${ad.copy.path1 ? `/${ad.copy.path1}` : ""}${ad.copy.path2 ? `/${ad.copy.path2}` : ""}`,
                              `Landing page: ${ad.destinationUrl ?? c.landingPage ?? ""}`,
                              ``,
                              `Headlines:`,
                              ...(ad.copy.headlines ?? []).map((h) => `- ${h}`),
                              ``,
                              `Descriptions:`,
                              ...(ad.copy.descriptions ?? []).map((d) => `- ${d}`),
                              ``,
                              `Keywords:`,
                              ...(ad.copy.keywords ?? []).map((k) => `- ${k}`),
                              ``,
                              `Negative keywords:`,
                              ...(ad.copy.negativeKeywords ?? []).map((k) => `- ${k}`),
                              ``,
                              `Performance Max concepts (planning only):`,
                              ...(ad.copy.pmaxConcepts ?? []).flatMap((concept, i) => [
                                ``,
                                `Concept ${i + 1}: ${concept.theme ?? ""}`,
                                `Audience: ${concept.audience ?? ""}`,
                                `Headlines: ${(concept.headlines ?? []).join(" | ")}`,
                              ]),
                            ].join("\n");
                            const blob = new Blob([text], { type: "text/plain" });
                            const href = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = href;
                            a.download = `${c.name.replace(/\s+/g, "-").toLowerCase()}-google.txt`;
                            a.click();
                            URL.revokeObjectURL(href);
                          }}
                        >
                          Export
                        </button>
                      </div>
                      <GoogleAdPreview
                        headlines={ad.copy.headlines ?? []}
                        descriptions={ad.copy.descriptions ?? []}
                        landingPage={ad.destinationUrl ?? c.landingPage ?? ""}
                        path1={ad.copy.path1}
                        path2={ad.copy.path2}
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {(
                          [
                            ["feed", "Feed"],
                            ["story", "Stories"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setMetaFormat(id)}
                            className={
                              metaFormat === id
                                ? "bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                                : "bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500"
                            }
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => {
                            const text = [
                              `Primary text:`,
                              ad.copy.primaryText ?? "",
                              ``,
                              `Headline: ${ad.copy.headlines?.[0] ?? ""}`,
                              `Description: ${ad.copy.descriptions?.[0] ?? ""}`,
                              `CTA: ${ad.copy.cta ?? ""}`,
                              `Landing page: ${ad.destinationUrl ?? c.landingPage ?? ""}`,
                            ].join("\n");
                            const blob = new Blob([text], { type: "text/plain" });
                            const href = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = href;
                            a.download = `${c.name.replace(/\s+/g, "-").toLowerCase()}-meta.txt`;
                            a.click();
                            URL.revokeObjectURL(href);
                          }}
                        >
                          Export
                        </button>
                      </div>
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
                        format={metaFormat}
                        imageLabel={
                          ad.creativeSource === "GENERATED"
                            ? ad.creative?.alt ??
                              "AI-generated concept — not a website photo"
                            : null
                        }
                      />
                    </div>
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
