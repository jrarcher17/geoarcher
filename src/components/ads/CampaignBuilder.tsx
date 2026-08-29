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
import { MESSAGING_ANGLES } from "@/lib/advertising/intelligence-providers/types";
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
  id?: string;
  title: string;
  rationale: string;
  source?: string;
  recommendedCampaign: {
    name?: string;
    goal?: string;
    audience?: string;
    budgetHint?: string;
  } | null;
  gap?: {
    recommendedAngle?: string;
    focusedOn?: string[];
    missing?: string[];
    label?: string;
  } | null;
}

interface PmaxConcept {
  theme: string;
  headlines: string[];
  descriptions: string[];
  audience: string;
}

interface GeneratedAssets {
  google: {
    adGroupName: string;
    headlines: string[];
    descriptions: string[];
    keywords: string[];
    negativeKeywords?: string[];
    path1?: string;
    path2?: string;
    pmaxConcepts?: PmaxConcept[];
  };
  meta: {
    adSetName: string;
    primaryText: string;
    headline: string;
    description: string;
    cta: string;
  };
  chatgpt?: {
    advertiser?: string;
    headline?: string;
    description?: string;
    prompt: string;
    answer: string;
    followUp: string | null;
    intents?: string[];
  };
  sellingPoints: string[];
  audienceRecommendation: string;
}

interface Grounding {
  patternCount: number;
  opportunityTitle: string | null;
  opportunityAngle: string | null;
  tone: string;
}

const GOALS = [
  { value: "LEADS", label: "Leads" },
  { value: "SALES", label: "Sales" },
  { value: "PRODUCT_SALES", label: "Product Sales" },
  { value: "TRAFFIC", label: "Website Traffic" },
  { value: "AWARENESS", label: "Awareness" },
  { value: "RETARGETING", label: "Retargeting" },
] as const;

const TONES = [
  "Premium",
  "Direct Response",
  "Professional",
  "Friendly",
  "Bold",
  "Scientific",
  "Luxury",
  "Minimal",
] as const;

function persistGoal(value: string): "LEADS" | "SALES" | "TRAFFIC" | "PHONE_CALLS" | "AWARENESS" {
  if (value === "PRODUCT_SALES") return "SALES";
  if (value === "RETARGETING") return "AWARENESS";
  if (value === "PHONE_CALLS") return "PHONE_CALLS";
  if (value === "SALES" || value === "TRAFFIC" || value === "AWARENESS") return value;
  return "LEADS";
}

function objectiveNote(value: string): string {
  if (value === "PRODUCT_SALES") return "Product sales";
  if (value === "RETARGETING") return "Retargeting people already familiar with the brand";
  return "";
}

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
  prospectId,
  initialAngle,
}: {
  siteId: string;
  siteUrl: string;
  businessName: string;
  offering: BuilderOffering;
  opportunity: BuilderOpportunity | null;
  images: BuilderImage[];
  prospectId?: string | null;
  initialAngle?: string | null;
}) {
  const router = useRouter();
  const rec = opportunity?.recommendedCampaign ?? null;

  const [step, setStep] = useState<"details" | "review">("details");
  const [name, setName] = useState(rec?.name ?? `${offering.name} Campaign`);
  const [goal, setGoal] = useState(goalFromRecommendation(rec?.goal));
  const [tone, setTone] = useState<(typeof TONES)[number]>("Professional");
  const [offer, setOffer] = useState("");
  const [angle, setAngle] = useState(
    initialAngle || opportunity?.gap?.recommendedAngle || ""
  );
  const [landingPage, setLandingPage] = useState(offering.url ?? siteUrl);
  const [budget, setBudget] = useState(budgetFromHint(rec?.budgetHint));
  const [location, setLocation] = useState("");
  const [audience, setAudience] = useState(rec?.audience ?? "");
  const [useGoogle, setUseGoogle] = useState(true);
  const [useMeta, setUseMeta] = useState(true);
  const [useChatgpt, setUseChatgpt] = useState(false);

  const [assets, setAssets] = useState<GeneratedAssets | null>(null);
  const [grounding, setGrounding] = useState<Grounding | null>(null);
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [conceptImage, setConceptImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);
  const [metaFormat, setMetaFormat] = useState<"feed" | "story">("feed");
  const [metaVersions, setMetaVersions] = useState<GeneratedAssets["meta"][]>([]);
  const [googleVersions, setGoogleVersions] = useState<GeneratedAssets["google"][]>([]);
  const [chatgptVersions, setChatgptVersions] = useState<
    NonNullable<GeneratedAssets["chatgpt"]>[]
  >([]);
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
  const previewImage = conceptImage?.url ?? creative?.url ?? null;
  const imageLabel = conceptImage?.alt ?? null;

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
        goal: persistGoal(goal),
        objectiveNote: objectiveNote(goal),
        tone,
        offer,
        angle,
        opportunityId: opportunity?.id,
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
      setGrounding(json.grounding ?? null);
      if (json.assets?.google) setGoogleVersions([json.assets.google]);
      if (json.assets?.meta) setMetaVersions([json.assets.meta]);
      if (json.assets?.chatgpt) setChatgptVersions([json.assets.chatgpt]);
      if (json.assets.audienceRecommendation && !audience) {
        setAudience(json.assets.audienceRecommendation);
      }
      if (!creativeId && orderedImages.length > 0) {
        setCreativeId(orderedImages[0].id);
      }
      setPreviewTab(useGoogle ? "google" : useMeta ? "meta" : "ai");
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
        goal: persistGoal(goal),
        landingPage,
        budgetDailyCents: budget ? Math.round(Number(budget) * 100) : null,
        location,
        audience,
        status,
        prospectId: prospectId || undefined,
        platforms: [
          ...(useGoogle ? ["GOOGLE"] : []),
          ...(useMeta ? ["META"] : []),
          ...(useChatgpt ? ["AI_CHAT"] : []),
        ],
        google: useGoogle ? assets.google : undefined,
        chatgpt: useChatgpt
          ? {
              ...assets.chatgpt,
              creative: conceptImage
                ? {
                    url: conceptImage.url,
                    alt: conceptImage.alt,
                    source: "GENERATED",
                  }
                : creative
                  ? {
                      siteImageId: creative.id,
                      url: creative.url,
                      alt: creative.alt,
                      source: "SITE_IMAGE",
                    }
                  : null,
            }
          : undefined,
        meta: useMeta
          ? {
              ...assets.meta,
              creative: conceptImage
                ? {
                    url: conceptImage.url,
                    alt: conceptImage.alt,
                    source: "GENERATED",
                  }
                : creative
                  ? {
                      siteImageId: creative.id,
                      url: creative.url,
                      alt: creative.alt,
                      source: "SITE_IMAGE",
                    }
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

  const metaBrief = () => ({
    offeringId: offering.id,
    name,
    goal: persistGoal(goal),
    objectiveNote: objectiveNote(goal),
    tone,
    offer,
    angle,
    opportunityId: opportunity?.id,
    landingPage,
    budgetDailyCents: budget ? Math.round(Number(budget) * 100) : null,
    location,
    audience,
  });

  async function handleGoogleGenerate(mode: "angle" | "version") {
    if (!assets) return;
    setBusy("generate");
    setError(null);
    try {
      const res = await callApi("/api/ad-studio/generate-google", metaBrief());
      const json = await res.json();
      if (!res.ok) {
        if (json.upgradeRequired) setUpgrade(true);
        throw new Error(json.error ?? "Google generation failed.");
      }
      if (mode === "version") {
        setGoogleVersions((prev) => [...prev, json.google]);
      } else {
        setGoogleVersions((prev) =>
          prev.length === 0 ? [json.google] : [...prev.slice(0, -1), json.google]
        );
      }
      patchAssets({ google: json.google });
      if (json.grounding) setGrounding(json.grounding);
      setPreviewTab("google");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleChatgptGenerate(mode: "angle" | "version") {
    if (!assets) return;
    setBusy("generate");
    setError(null);
    try {
      const res = await callApi("/api/ad-studio/generate-chatgpt", metaBrief());
      const json = await res.json();
      if (!res.ok) {
        if (json.upgradeRequired) setUpgrade(true);
        throw new Error(json.error ?? "ChatGPT generation failed.");
      }
      if (mode === "version") {
        setChatgptVersions((prev) => [...prev, json.chatgpt]);
      } else {
        setChatgptVersions((prev) =>
          prev.length === 0 ? [json.chatgpt] : [...prev.slice(0, -1), json.chatgpt]
        );
      }
      patchAssets({ chatgpt: json.chatgpt });
      if (json.grounding) setGrounding(json.grounding);
      setPreviewTab("ai");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ChatGPT generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleMetaGenerate(mode: "angle" | "version") {
    if (!assets) return;
    setBusy("generate");
    setError(null);
    try {
      const res = await callApi("/api/ad-studio/generate-meta", metaBrief());
      const json = await res.json();
      if (!res.ok) {
        if (json.upgradeRequired) setUpgrade(true);
        throw new Error(json.error ?? "Meta generation failed.");
      }
      if (mode === "version") {
        setMetaVersions((prev) => [...prev, json.meta]);
      } else {
        setMetaVersions((prev) =>
          prev.length === 0 ? [json.meta] : [...prev.slice(0, -1), json.meta]
        );
      }
      patchAssets({ meta: json.meta });
      if (json.grounding) setGrounding(json.grounding);
      setPreviewTab("meta");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meta generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleConceptImage(target: "meta" | "ai" = "meta") {
    setBusy("generate");
    setError(null);
    try {
      const res = await callApi("/api/ad-studio/concept-image", {
        offeringId: offering.id,
        angle,
        headline:
          target === "ai" ? assets?.chatgpt?.headline : assets?.meta.headline,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Concept image failed.");
      setConceptImage({ url: json.url, alt: json.alt });
      setCreativeId(null);
      setPreviewTab(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Concept image failed.");
    } finally {
      setBusy(null);
    }
  }

  function exportGoogle() {
    if (!assets) return;
    const g = assets.google;
    const pmax = g.pmaxConcepts ?? [];
    const text = [
      `Platform: Google`,
      `Ad group: ${g.adGroupName}`,
      `Display URL: ${landingPage}${g.path1 ? ` / ${g.path1}` : ""}${g.path2 ? ` / ${g.path2}` : ""}`,
      `Landing page: ${landingPage}`,
      ``,
      `Headlines:`,
      ...g.headlines.map((h) => `- ${h}`),
      ``,
      `Descriptions:`,
      ...g.descriptions.map((d) => `- ${d}`),
      ``,
      `Keywords:`,
      ...(g.keywords ?? []).map((k) => `- ${k}`),
      ``,
      `Negative keywords:`,
      ...(g.negativeKeywords ?? []).map((k) => `- ${k}`),
      ``,
      `Performance Max concepts (planning only — not a live campaign):`,
      ...pmax.flatMap((c, i) => [
        ``,
        `Concept ${i + 1}: ${c.theme}`,
        `Audience: ${c.audience}`,
        `Headlines: ${c.headlines.join(" | ")}`,
        `Descriptions: ${c.descriptions.join(" | ")}`,
      ]),
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-google.txt`;
    a.click();
    URL.revokeObjectURL(href);
  }

  function exportChatgpt() {
    if (!assets?.chatgpt) return;
    const c = assets.chatgpt;
    const text = [
      `Platform: ChatGPT`,
      `Note: Prepared creative and targeting context — not a live placement.`,
      `Advertiser: ${c.advertiser ?? businessName}`,
      `Headline: ${c.headline ?? ""}`,
      `Description: ${c.description ?? ""}`,
      `Landing page: ${landingPage}`,
      ``,
      `Buyer prompt:`,
      c.prompt,
      ``,
      `Recommended answer:`,
      c.answer,
      ``,
      `Follow-up: ${c.followUp ?? ""}`,
      ``,
      `Intent / context:`,
      ...(c.intents ?? []).map((i) => `- ${i}`),
      conceptImage ? `Creative: ${conceptImage.alt} (${conceptImage.url})` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-chatgpt.txt`;
    a.click();
    URL.revokeObjectURL(href);
  }

  function exportMeta() {
    if (!assets) return;
    const text = [
      `Platform: Meta`,
      `Format: ${metaFormat}`,
      `Primary text:`,
      assets.meta.primaryText,
      ``,
      `Headline: ${assets.meta.headline}`,
      `Description: ${assets.meta.description}`,
      `CTA: ${assets.meta.cta}`,
      `Landing page: ${landingPage}`,
      conceptImage ? `Creative: ${conceptImage.alt} (${conceptImage.url})` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-meta.txt`;
    a.click();
    URL.revokeObjectURL(href);
  }

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
            <div className="mt-1 max-w-2xl">
              <p className="text-sm leading-relaxed text-slate-600">
                {opportunity.rationale}
              </p>
              {opportunity.gap?.recommendedAngle && (
                <p className="mt-2 text-sm font-medium text-slate-900">
                  Angle · {opportunity.gap.recommendedAngle}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {opportunity.gap.label ?? "AI Recommendation"}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
        {step === "review" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setStep("details")}
            >
              Edit details
            </button>
            <button
              type="button"
              className="btn-secondary text-sm disabled:opacity-60"
              disabled={busy === "generate"}
              onClick={() => void handleGenerate()}
            >
              {busy === "generate" ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
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
            <label className={labelClass}>Tone</label>
            <select
              className={inputClass}
              value={tone}
              onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useChatgpt}
                  onChange={(e) => setUseChatgpt(e.target.checked)}
                />
                ChatGPT
              </label>
            </div>
            <p className="text-xs text-slate-400">
              ChatGPT generates an original recommended answer. There is no official
              ads API — nothing is placed.
            </p>
          </div>
          <div>
            <label className={labelClass}>Messaging angle</label>
            <input
              className={inputClass}
              placeholder="Optional — or from a competitor-gap opportunity"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Offer</label>
            <input
              className={inputClass}
              placeholder="Optional. Only used if it matches the site."
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
            />
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
                (!useGoogle && !useMeta && !useChatgpt)
              }
              onClick={() => void handleGenerate()}
            >
              {busy === "generate"
                ? "Generating original ads…"
                : "Generate ads with AI"}
            </button>
            <p className="mt-2 text-xs text-slate-400">
              Copy is original and grounded in your website. Competitor library ads
              inform patterns only — they are never copied. You review everything
              before anything is saved.
            </p>
          </div>
        </div>
      )}

      {step === "review" && assets && (
        <div className="mt-6 flex flex-col gap-8">
          {grounding && (
            <p className="text-xs text-slate-400">
              {grounding.tone} tone
              {grounding.opportunityTitle
                ? ` · opportunity “${grounding.opportunityTitle}”`
                : ""}
              {grounding.opportunityAngle
                ? ` · angle “${grounding.opportunityAngle}”`
                : ""}
              {grounding.patternCount > 0
                ? ` · ${grounding.patternCount} analyzed library-ad patterns (not copied)`
                : " · website only — no analyzed competitor ads"}
            </p>
          )}

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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Display path 1 (max 15)</label>
                      <input
                        className={inputClass}
                        maxLength={15}
                        value={assets.google.path1 ?? ""}
                        onChange={(e) =>
                          patchAssets({
                            google: { ...assets.google, path1: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Display path 2 (max 15)</label>
                      <input
                        className={inputClass}
                        maxLength={15}
                        value={assets.google.path2 ?? ""}
                        onChange={(e) =>
                          patchAssets({
                            google: { ...assets.google, path2: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                  <ListEditor
                    label={`Keywords (${assets.google.keywords.length})`}
                    values={assets.google.keywords}
                    onChange={(keywords) =>
                      patchAssets({ google: { ...assets.google, keywords } })
                    }
                    rows={6}
                  />
                  <ListEditor
                    label={`Negative keywords (${(assets.google.negativeKeywords ?? []).length})`}
                    values={assets.google.negativeKeywords ?? []}
                    onChange={(negativeKeywords) =>
                      patchAssets({ google: { ...assets.google, negativeKeywords } })
                    }
                    rows={4}
                    hint="Off-intent terms to exclude. Suggestions only — not published."
                  />

                  {(assets.google.pmaxConcepts ?? []).length > 0 && (
                    <div>
                      <SectionLabel>Performance Max concepts</SectionLabel>
                      <p className="mb-3 mt-1 text-xs text-slate-400">
                        Planning concepts only — not a live Performance Max campaign.
                        GEO Archer does not publish PMax.
                      </p>
                      <div className="flex flex-col gap-3">
                        {(assets.google.pmaxConcepts ?? []).map((concept, i) => (
                          <div
                            key={`${concept.theme}-${i}`}
                            className="border border-slate-100 bg-slate-50 p-3"
                          >
                            <p className="text-sm font-medium text-slate-900">
                              {concept.theme || `Concept ${i + 1}`}
                            </p>
                            {concept.audience && (
                              <p className="mt-1 text-xs text-slate-500">
                                {concept.audience}
                              </p>
                            )}
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {concept.headlines.map((h) => (
                                <li
                                  key={h}
                                  className="bg-white px-2 py-0.5 text-xs text-slate-700"
                                >
                                  {h}
                                </li>
                              ))}
                            </ul>
                            {concept.descriptions.map((d) => (
                              <p
                                key={d}
                                className="mt-1.5 text-xs leading-relaxed text-slate-600"
                              >
                                {d}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <select
                      className={inputClass}
                      value={
                        MESSAGING_ANGLES.includes(
                          angle as (typeof MESSAGING_ANGLES)[number]
                        )
                          ? angle
                          : ""
                      }
                      onChange={(e) => setAngle(e.target.value)}
                    >
                      <option value="">Change angle…</option>
                      {MESSAGING_ANGLES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary text-sm disabled:opacity-60"
                      disabled={busy === "generate" || !angle}
                      onClick={() => void handleGoogleGenerate("angle")}
                    >
                      Apply angle
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm disabled:opacity-60"
                      disabled={busy === "generate"}
                      onClick={() => void handleGoogleGenerate("version")}
                    >
                      Create new version
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={exportGoogle}
                    >
                      Export
                    </button>
                  </div>
                  {googleVersions.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {googleVersions.map((version, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => patchAssets({ google: version })}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium",
                            assets.google === version ||
                              assets.google.headlines[0] === version.headlines[0]
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          Version {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
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
                          onClick={() => {
                            setConceptImage(null);
                            setCreativeId(creativeId === img.id ? null : img.id);
                          }}
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
                      Images discovered on your website. Click to select. Concept
                      images are labeled as AI-generated — not site photos.
                    </p>
                    <button
                      type="button"
                      className="btn-secondary mt-3 text-sm disabled:opacity-60"
                      disabled={busy === "generate"}
                      onClick={() => void handleConceptImage()}
                    >
                      {busy === "generate" && !assets
                        ? "Working…"
                        : "Generate concept image"}
                    </button>
                    {conceptImage && (
                      <p className="mt-2 text-xs text-slate-500">{conceptImage.alt}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <select
                      className={inputClass}
                      value={
                        MESSAGING_ANGLES.includes(
                          angle as (typeof MESSAGING_ANGLES)[number]
                        )
                          ? angle
                          : ""
                      }
                      onChange={(e) => setAngle(e.target.value)}
                    >
                      <option value="">Change angle…</option>
                      {MESSAGING_ANGLES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary text-sm disabled:opacity-60"
                      disabled={busy === "generate" || !angle}
                      onClick={() => void handleMetaGenerate("angle")}
                    >
                      Apply angle
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm disabled:opacity-60"
                      disabled={busy === "generate"}
                      onClick={() => void handleMetaGenerate("version")}
                    >
                      Create new version
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={exportMeta}
                    >
                      Export
                    </button>
                  </div>
                  {metaVersions.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {metaVersions.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => patchAssets({ meta: metaVersions[i] })}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium",
                            assets.meta === metaVersions[i] ||
                              assets.meta.headline === metaVersions[i].headline
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          Version {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {useChatgpt && assets.chatgpt && (
                <div className="flex flex-col gap-4">
                  <SectionLabel>ChatGPT assets</SectionLabel>
                  <p className="text-xs text-slate-400">
                    ChatGPT advertising has its own requirements. GEO Archer
                    prepares the creative and targeting context. There is no
                    official ads API — this is not a live placement.
                  </p>
                  <div>
                    <label className={labelClass}>Advertiser</label>
                    <input
                      className={inputClass}
                      value={assets.chatgpt.advertiser ?? businessName}
                      onChange={(e) =>
                        patchAssets({
                          chatgpt: {
                            ...assets.chatgpt!,
                            advertiser: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Headline (max 70)</label>
                    <input
                      className={inputClass}
                      maxLength={70}
                      value={assets.chatgpt.headline ?? ""}
                      onChange={(e) =>
                        patchAssets({
                          chatgpt: {
                            ...assets.chatgpt!,
                            headline: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Description (max 180)</label>
                    <textarea
                      className={inputClass}
                      rows={3}
                      maxLength={180}
                      value={assets.chatgpt.description ?? ""}
                      onChange={(e) =>
                        patchAssets({
                          chatgpt: {
                            ...assets.chatgpt!,
                            description: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <ListEditor
                    label={`Intent / context (${(assets.chatgpt.intents ?? []).length})`}
                    values={assets.chatgpt.intents ?? []}
                    onChange={(intents) =>
                      patchAssets({ chatgpt: { ...assets.chatgpt!, intents } })
                    }
                    rows={5}
                    hint="Buyer intents ChatGPT might use as targeting context. Suggestions only."
                  />
                  <div>
                    <label className={labelClass}>Buyer prompt</label>
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={assets.chatgpt.prompt}
                      onChange={(e) =>
                        patchAssets({
                          chatgpt: { ...assets.chatgpt!, prompt: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Recommended answer</label>
                    <textarea
                      className={inputClass}
                      rows={6}
                      value={assets.chatgpt.answer}
                      onChange={(e) =>
                        patchAssets({
                          chatgpt: { ...assets.chatgpt!, answer: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Follow-up</label>
                    <input
                      className={inputClass}
                      value={assets.chatgpt.followUp ?? ""}
                      onChange={(e) =>
                        patchAssets({
                          chatgpt: {
                            ...assets.chatgpt!,
                            followUp: e.target.value || null,
                          },
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
                          onClick={() => {
                            setConceptImage(null);
                            setCreativeId(creativeId === img.id ? null : img.id);
                          }}
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
                    <button
                      type="button"
                      className="btn-secondary mt-3 text-sm disabled:opacity-60"
                      disabled={busy === "generate"}
                      onClick={() => void handleConceptImage("ai")}
                    >
                      Generate concept image
                    </button>
                    {conceptImage && (
                      <p className="mt-2 text-xs text-slate-500">{conceptImage.alt}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <select
                      className={inputClass}
                      value={
                        MESSAGING_ANGLES.includes(
                          angle as (typeof MESSAGING_ANGLES)[number]
                        )
                          ? angle
                          : ""
                      }
                      onChange={(e) => setAngle(e.target.value)}
                    >
                      <option value="">Change angle…</option>
                      {MESSAGING_ANGLES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary text-sm disabled:opacity-60"
                      disabled={busy === "generate" || !angle}
                      onClick={() => void handleChatgptGenerate("angle")}
                    >
                      Apply angle
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm disabled:opacity-60"
                      disabled={busy === "generate"}
                      onClick={() => void handleChatgptGenerate("version")}
                    >
                      Create new version
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={exportChatgpt}
                    >
                      Export
                    </button>
                  </div>
                  {chatgptVersions.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {chatgptVersions.map((version, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => patchAssets({ chatgpt: version })}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium",
                            assets.chatgpt === version ||
                              assets.chatgpt?.headline === version.headline
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          Version {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
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
                {useChatgpt && (
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
                    ChatGPT
                  </button>
                )}
              </div>
              <div className="mt-3">
                {previewTab === "google" && (
                  <GoogleAdPreview
                    headlines={assets.google.headlines}
                    descriptions={assets.google.descriptions}
                    landingPage={landingPage}
                    path1={assets.google.path1}
                    path2={assets.google.path2}
                  />
                )}
                {previewTab === "meta" && (
                  <div>
                    <div className="mb-2 flex gap-1">
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
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium",
                            metaFormat === id
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <MetaAdPreview
                      businessName={businessName}
                      primaryText={assets.meta.primaryText}
                      headline={assets.meta.headline}
                      description={assets.meta.description}
                      cta={assets.meta.cta}
                      imageUrl={previewImage}
                      landingPage={landingPage}
                      format={metaFormat}
                      imageLabel={imageLabel}
                    />
                  </div>
                )}
                {previewTab === "ai" && (
                  <AiAdPreview
                    advertiser={assets.chatgpt?.advertiser ?? businessName}
                    headline={assets.chatgpt?.headline}
                    description={assets.chatgpt?.description}
                    prompt={assets.chatgpt?.prompt}
                    answer={assets.chatgpt?.answer}
                    followUp={assets.chatgpt?.followUp}
                    landingPage={landingPage}
                    intents={assets.chatgpt?.intents}
                    imageUrl={previewImage}
                    imageLabel={imageLabel}
                  />
                )}
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
                    {[useGoogle && "Google", useMeta && "Meta", useChatgpt && "ChatGPT"]
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
            {useGoogle && (
              <span
                className="cursor-not-allowed bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
                title="Connect Google in Integrations. Publishing stays disabled until OAuth is configured."
              >
                Publish to Google
              </span>
            )}
            {useMeta && (
              <span
                className="cursor-not-allowed bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
                title="Connect Meta in Integrations. Publishing stays disabled until OAuth is configured."
              >
                Publish to Meta
              </span>
            )}
            {useChatgpt && (
              <span
                className="cursor-not-allowed bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
                title="There is no official ChatGPT ads API. GEO Archer prepares creative and targeting context only."
              >
                Publish to ChatGPT
              </span>
            )}
            <p className="text-xs text-slate-400">
              Nothing is published or spends money. Publishing requires a connected
              ad account in{" "}
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
