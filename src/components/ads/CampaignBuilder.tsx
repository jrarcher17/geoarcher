"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionLabel } from "@/components/os/primitives";
import {
  AiAdPreview,
  GoogleAdPreview,
  MetaAdPreview,
} from "@/components/ads/previews";
import { cn } from "@/lib/utils";

export interface BuilderOffering {
  id: string;
  kind: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  price: string | null;
  url: string | null;
}

export interface BuilderImage {
  id: string;
  url: string;
  alt: string | null;
  offeringId?: string | null;
}

export interface BuilderOpportunity {
  title: string;
  rationale: string;
  recommendedCampaign: {
    name?: string;
    goal?: string;
    audience?: string;
    budgetHint?: string;
  } | null;
}

interface GeneratedAssets {
  google: {
    adGroupName: string;
    headlines: string[];
    descriptions: string[];
    keywords: string[];
  };
  meta: {
    adSetName: string;
    primaryText: string;
    headline: string;
    description: string;
    cta: string;
  };
  sellingPoints: string[];
  audienceRecommendation: string;
}

const GOALS = [
  { value: "LEADS", label: "Leads" },
  { value: "SALES", label: "Sales" },
  { value: "TRAFFIC", label: "Website Traffic" },
  { value: "PHONE_CALLS", label: "Phone Calls" },
  { value: "AWARENESS", label: "Awareness" },
] as const;

const META_CTAS = [
  "LEARN_MORE",
  "SIGN_UP",
  "GET_QUOTE",
  "CONTACT_US",
  "BOOK_NOW",
  "SHOP_NOW",
  "SUBSCRIBE",
  "GET_OFFER",
] as const;

function goalFromRecommendation(value: string | undefined): string {
  return GOALS.some((g) => g.value === value) ? (value as string) : "LEADS";
}

/** Pull a starting daily budget from an AI hint like "$30-50/day". */
function budgetFromHint(hint: string | undefined): string {
  const match = hint?.match(/\$?(\d+)/);
  return match ? match[1] : "";
}

const inputClass =
  "w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900";
const labelClass =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400";

function ListEditor({
  label,
  values,
  onChange,
  hint,
  rows = 5,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        className={cn(inputClass, "font-mono text-xs leading-relaxed")}
        rows={rows}
        value={values.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function CampaignBuilder({
  siteId,
  siteUrl,
  businessName,
  offering,
  opportunity,
  images,
}: {
  siteId: string;
  siteUrl: string;
  businessName: string;
  offering: BuilderOffering;
  opportunity: BuilderOpportunity | null;
  images: BuilderImage[];
}) {
  const router = useRouter();
  const rec = opportunity?.recommendedCampaign ?? null;

  const [step, setStep] = useState<"details" | "review">("details");
  const [name, setName] = useState(rec?.name ?? `${offering.name} Campaign`);
  const [goal, setGoal] = useState(goalFromRecommendation(rec?.goal));
  const [landingPage, setLandingPage] = useState(offering.url ?? siteUrl);
  const [budget, setBudget] = useState(budgetFromHint(rec?.budgetHint));
  const [location, setLocation] = useState("");
  const [audience, setAudience] = useState(rec?.audience ?? "");
  const [useGoogle, setUseGoogle] = useState(true);
  const [useMeta, setUseMeta] = useState(true);

  const [assets, setAssets] = useState<GeneratedAssets | null>(null);
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"google" | "meta" | "ai">("google");
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  // Offering-specific images first, then the rest of the site's library.
  const orderedImages = useMemo(() => {
    const own = images.filter((i) => i.offeringId === offering.id);
    const rest = images.filter((i) => i.offeringId !== offering.id);
    return [...own, ...rest].slice(0, 24);
  }, [images, offering.id]);
  const creative = orderedImages.find((i) => i.id === creativeId) ?? null;

  async function callApi(path: string, payload: unknown): Promise<Response> {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function handleGenerate() {
    setBusy("generate");
    setError(null);
    try {
      const res = await callApi("/api/ad-studio/generate", {
        offeringId: offering.id,
        name,
        goal,
        landingPage,
        budgetDailyCents: budget ? Math.round(Number(budget) * 100) : null,
        location,
        audience,
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.upgradeRequired) setUpgrade(true);
        throw new Error(json.error ?? "Generation failed.");
      }
      setAssets(json.assets);
      if (json.assets.audienceRecommendation && !audience) {
        setAudience(json.assets.audienceRecommendation);
      }
      if (!creativeId && orderedImages.length > 0) {
        setCreativeId(orderedImages[0].id);
      }
      setPreviewTab(useGoogle ? "google" : "meta");
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(status: "DRAFT" | "READY") {
    if (!assets) return;
    setBusy("save");
    setError(null);
    try {
      const res = await callApi("/api/campaigns", {
        siteId,
        offeringId: offering.id,
        name,
        goal,
        landingPage,
        budgetDailyCents: budget ? Math.round(Number(budget) * 100) : null,
        location,
        audience,
        status,
        platforms: [...(useGoogle ? ["GOOGLE"] : []), ...(useMeta ? ["META"] : [])],
        google: useGoogle ? assets.google : undefined,
        meta: useMeta
          ? {
              ...assets.meta,
              creative: creative
                ? { siteImageId: creative.id, url: creative.url, alt: creative.alt }
                : null,
            }
          : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.upgradeRequired) setUpgrade(true);
        throw new Error(json.error ?? "Could not save the campaign.");
      }
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the campaign.");
      setBusy(null);
    }
  }

  const patchAssets = (patch: Partial<GeneratedAssets>) =>
    setAssets((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <section className="border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>
            {step === "details" ? "Campaign details" : "Review campaign"}
          </SectionLabel>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            {offering.name}
          </h2>
          {opportunity && step === "details" && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              {opportunity.rationale}
            </p>
          )}
        </div>
        {step === "review" && (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setStep("details")}
          >
            Edit details
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          {upgrade && (
            <>
              {" "}
              <Link href="/settings?tab=billing" className="font-medium underline">
                Upgrade to Pro
              </Link>
            </>
          )}
        </p>
      )}

      {step === "details" && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Campaign name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Advertising goal</label>
            <select
              className={inputClass}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Daily budget (USD)</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              placeholder="50"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Landing page</label>
            <input
              className={inputClass}
              value={landingPage}
              onChange={(e) => setLandingPage(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              Auto-selected from your website — change it if you prefer another page.
            </p>
          </div>
          <div>
            <label className={labelClass}>Target location</label>
            <input
              className={inputClass}
              placeholder="e.g. Los Angeles, CA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Platforms</label>
            <div className="flex flex-wrap items-center gap-4 py-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useGoogle}
                  onChange={(e) => setUseGoogle(e.target.checked)}
                />
                Google
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useMeta}
                  onChange={(e) => setUseMeta(e.target.checked)}
                />
                Meta
              </label>
              <span className="text-xs text-slate-400">AI / ChatGPT — coming soon</span>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Audience</label>
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Who should see these ads?"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-60"
              disabled={
                busy === "generate" ||
                !name.trim() ||
                !landingPage.trim() ||
                (!useGoogle && !useMeta)
              }
              onClick={() => void handleGenerate()}
            >
              {busy === "generate"
                ? "Generating ads from your website…"
                : "Generate ads with AI"}
            </button>
            <p className="mt-2 text-xs text-slate-400">
              The AI writes copy using only claims found on your website. You review
              everything before anything is saved.
            </p>
          </div>
        </div>
      )}

      {step === "review" && assets && (
        <div className="mt-6 flex flex-col gap-8">
          {assets.sellingPoints.length > 0 && (
            <div>
              <SectionLabel>Selling points the AI used</SectionLabel>
              <ul className="mt-2 flex flex-wrap gap-2">
                {assets.sellingPoints.map((s) => (
                  <li
                    key={s}
                    className="bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              {useGoogle && (
                <div className="flex flex-col gap-4">
                  <SectionLabel>Google assets</SectionLabel>
                  <ListEditor
                    label={`Headlines (${assets.google.headlines.length}) — max 30 characters`}
                    values={assets.google.headlines}
                    onChange={(headlines) =>
                      patchAssets({ google: { ...assets.google, headlines } })
                    }
                    rows={8}
                    hint="One per line."
                  />
                  <ListEditor
                    label="Descriptions — max 90 characters"
                    values={assets.google.descriptions}
                    onChange={(descriptions) =>
                      patchAssets({ google: { ...assets.google, descriptions } })
                    }
                    rows={4}
                  />
                  <ListEditor
                    label={`Keywords (${assets.google.keywords.length})`}
                    values={assets.google.keywords}
                    onChange={(keywords) =>
                      patchAssets({ google: { ...assets.google, keywords } })
                    }
                    rows={6}
                  />
                </div>
              )}

              {useMeta && (
                <div className="flex flex-col gap-4">
                  <SectionLabel>Meta assets</SectionLabel>
                  <div>
                    <label className={labelClass}>Primary text</label>
                    <textarea
                      className={inputClass}
                      rows={4}
                      value={assets.meta.primaryText}
                      onChange={(e) =>
                        patchAssets({
                          meta: { ...assets.meta, primaryText: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Headline (max 40)</label>
                      <input
                        className={inputClass}
                        value={assets.meta.headline}
                        onChange={(e) =>
                          patchAssets({
                            meta: { ...assets.meta, headline: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>CTA</label>
                      <select
                        className={inputClass}
                        value={assets.meta.cta}
                        onChange={(e) =>
                          patchAssets({ meta: { ...assets.meta, cta: e.target.value } })
                        }
                      >
                        {META_CTAS.map((c) => (
                          <option key={c} value={c}>
                            {c.replaceAll("_", " ").toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Description (max 30)</label>
                    <input
                      className={inputClass}
                      value={assets.meta.description}
                      onChange={(e) =>
                        patchAssets({
                          meta: { ...assets.meta, description: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Ad creative</label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {orderedImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() =>
                            setCreativeId(creativeId === img.id ? null : img.id)
                          }
                          className={cn(
                            "border-2 transition",
                            creativeId === img.id
                              ? "border-slate-900"
                              : "border-transparent hover:border-slate-300"
                          )}
                        >
                          <Image
                            src={img.url}
                            alt={img.alt ?? ""}
                            width={120}
                            height={80}
                            unoptimized
                            className="h-16 w-full bg-slate-50 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Images discovered on your website. Click to select or deselect;
                      uploads and AI-generated creative are coming later.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <SectionLabel>Preview</SectionLabel>
              <div className="mt-2 flex gap-1">
                {useGoogle && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab("google")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium",
                      previewTab === "google"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Google
                  </button>
                )}
                {useMeta && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab("meta")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium",
                      previewTab === "meta"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Meta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewTab("ai")}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium",
                    previewTab === "ai"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500 hover:text-slate-800"
                  )}
                >
                  AI / ChatGPT
                </button>
              </div>
              <div className="mt-3">
                {previewTab === "google" && (
                  <GoogleAdPreview
                    headlines={assets.google.headlines}
                    descriptions={assets.google.descriptions}
                    landingPage={landingPage}
                  />
                )}
                {previewTab === "meta" && (
                  <MetaAdPreview
                    businessName={businessName}
                    primaryText={assets.meta.primaryText}
                    headline={assets.meta.headline}
                    description={assets.meta.description}
                    cta={assets.meta.cta}
                    imageUrl={creative?.url ?? null}
                    landingPage={landingPage}
                  />
                )}
                {previewTab === "ai" && <AiAdPreview />}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 border border-slate-100 bg-slate-50 p-4 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                    Goal
                  </dt>
                  <dd className="text-slate-900">
                    {GOALS.find((g) => g.value === goal)?.label}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                    Daily budget
                  </dt>
                  <dd className="text-slate-900">{budget ? `$${budget}/day` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                    Location
                  </dt>
                  <dd className="text-slate-900">{location || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                    Platforms
                  </dt>
                  <dd className="text-slate-900">
                    {[useGoogle && "Google", useMeta && "Meta"]
                      .filter(Boolean)
                      .join(" + ")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-60"
              disabled={busy === "save"}
              onClick={() => void handleSave("READY")}
            >
              {busy === "save" ? "Saving…" : "Approve — mark Ready"}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm disabled:opacity-60"
              disabled={busy === "save"}
              onClick={() => void handleSave("DRAFT")}
            >
              Save Draft
            </button>
            <p className="text-xs text-slate-400">
              Nothing is published or spends money. Publishing to Google/Meta
              requires a connected ad account in{" "}
              <Link href="/integrations" className="underline underline-offset-2">
                Integrations
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
