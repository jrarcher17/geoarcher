"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { CreativeLayout } from "@/components/ads/CreativeLayout";
import { EmptyState, ErrorBanner, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CREATIVE_FORMATS,
  CREATIVE_PLATFORMS,
  FORMAT_SPECS,
  type CreativeFormat,
  type CreativePlatform,
} from "@/lib/advertising/creative-formats";
import type { LayoutCopy, ConceptCard } from "@/lib/advertising/creative-studio";
import { MESSAGING_ANGLES } from "@/lib/advertising/intelligence-providers/types";
import { rankImagesForOffering } from "@/lib/advertising/image-pick";
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

interface SiteImage {
  id: string;
  url: string;
  alt: string | null;
  pageUrl?: string | null;
  offeringId?: string | null;
}

interface Intelligence {
  siteUrl: string | null;
  status: string | null;
  hasCompletedScan: boolean;
  offerings: OfferingItem[];
  images: SiteImage[];
}

const PLATFORM_LABEL: Record<CreativePlatform, string> = {
  META: "Meta",
  GOOGLE: "Google",
  AI_CHAT: "ChatGPT",
};

const inputClass =
  "w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900";
const labelClass =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400";

function CreativeStudioInner() {
  const params = useSearchParams();
  const { data: insights } = useInsights();
  const [siteId, setSiteId] = useState<string | null>(params.get("site"));
  const [selected, setSelected] = useState<string | null>(params.get("offering"));
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  const [platform, setPlatform] = useState<CreativePlatform>("META");
  const [angle, setAngle] = useState<(typeof MESSAGING_ANGLES)[number]>(
    "Performance"
  );
  const [format, setFormat] = useState<CreativeFormat>("feed");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [useAiImage, setUseAiImage] = useState(false);

  const [copy, setCopy] = useState<LayoutCopy | null>(null);
  const [aiImage, setAiImage] = useState<{ url: string; alt: string } | null>(
    null
  );
  const [concepts, setConcepts] = useState<ConceptCard[] | null>(null);
  const [busy, setBusy] = useState<"layout" | "concepts" | null>(null);

  const sites = useMemo(() => insights?.sites ?? [], [insights]);
  const plan = insights?.plan ?? null;

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

  const offering = intel?.offerings.find((o) => o.id === selected) ?? null;
  const orderedImages = useMemo(() => {
    if (!intel || !offering) return [];
    return rankImagesForOffering(intel.images, offering);
  }, [intel, offering]);

  useEffect(() => {
    setCopy(null);
    setAiImage(null);
    setConcepts(null);
    setSourceId(null);
    setUseAiImage(false);
  }, [selected]);

  const siteImage = orderedImages.find((i) => i.id === sourceId) ?? null;
  const previewUrl = useAiImage ? aiImage?.url ?? null : siteImage?.url ?? null;
  const previewLabel = useAiImage
    ? aiImage?.alt ??
      "AI-generated concept — not a website photo. Not a catalog shot of this product."
    : siteImage
      ? "Layout using a photo from your website. The product image is unchanged."
      : "Select a website photo or generate an AI concept.";

  async function callApi(path: string, payload: unknown): Promise<Response> {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function handleGenerateLayout() {
    if (!offering) return;
    setBusy("layout");
    setError(null);
    try {
      const res = await callApi("/api/creative-studio/generate", {
        offeringId: offering.id,
        platform,
        angle,
        format,
        generateImage: useAiImage,
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.upgradeRequired) setUpgrade(true);
        throw new Error(json.error ?? "Generation failed.");
      }
      setCopy(json.copy);
      if (json.image) setAiImage(json.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateConcepts() {
    if (!offering) return;
    setBusy("concepts");
    setError(null);
    try {
      const res = await callApi("/api/creative-studio/concepts", {
        offeringId: offering.id,
        platform,
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.upgradeRequired) setUpgrade(true);
        throw new Error(json.error ?? "Concept generation failed.");
      }
      setConcepts(json.concepts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Concept generation failed.");
    } finally {
      setBusy(null);
    }
  }

  function applyConcept(card: ConceptCard) {
    setCopy({
      hook: card.hook,
      headline: card.headline,
      description: card.description,
      cta: card.cta,
      creativeConcept: card.creativeConcept,
      platforms: card.platforms,
    });
    if ((MESSAGING_ANGLES as readonly string[]).includes(card.angle)) {
      setAngle(card.angle as (typeof MESSAGING_ANGLES)[number]);
    }
  }

  function exportCopy() {
    if (!copy || !offering) return;
    const text = [
      `Creative Studio`,
      `Product: ${offering.name}`,
      `Platform: ${PLATFORM_LABEL[platform]}`,
      `Format: ${FORMAT_SPECS[format].label}`,
      `Angle: ${angle}`,
      ``,
      `Hook: ${copy.hook}`,
      `Headline: ${copy.headline}`,
      `Description: ${copy.description}`,
      `CTA: ${copy.cta}`,
      `Creative concept: ${copy.creativeConcept}`,
      ``,
      previewLabel,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${offering.name.replace(/\s+/g, "-").toLowerCase()}-creative.txt`;
    a.click();
    URL.revokeObjectURL(href);
  }

  const createAdHref =
    siteId && offering
      ? `/ad-studio?site=${siteId}&offering=${offering.id}&angle=${encodeURIComponent(angle)}`
      : "/ad-studio";

  return (
    <AppShell
      title="Creative Studio"
      subtitle="Compose feed, story, and display layouts from your scanned product images. AI concepts are labeled. Website photos are not altered."
    >
      {error && <ErrorBanner message={error} />}

      {upgrade && (
        <EmptyState
          title="Creative Studio is on Pro"
          body="Upgrade to generate layouts and concept cards from your products."
          actionHref="/settings?tab=billing"
          actionLabel="View plans"
        />
      )}

      {insights && sites.length === 0 && !siteId && (
        <EmptyState
          title="Creative Studio needs a scanned website"
          body="Add your site so GEO Archer can use the product images found on your pages."
          actionHref="/sites"
          actionLabel="+ Add Site"
        />
      )}

      {(sites.length > 0 || siteId) && !upgrade && (
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
                  ? "No products or services identified yet"
                  : "This site hasn't been scanned yet"}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Creative Studio works from products and images found on your
                website. Scan the site first, then open Site Intelligence.
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
              <SectionLabel>Product</SectionLabel>
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
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
                      {o.description}
                    </p>
                    {o.images.length > 0 && (
                      <p className="mt-3 text-xs text-slate-400">
                        {o.images.length} website image
                        {o.images.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {offering && (
            <section className="border border-slate-200 bg-white p-6 sm:p-8">
              <SectionLabel>Layout</SectionLabel>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Platform</label>
                  <select
                    className={inputClass}
                    value={platform}
                    onChange={(e) =>
                      setPlatform(e.target.value as CreativePlatform)
                    }
                  >
                    {CREATIVE_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {PLATFORM_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Ad angle</label>
                  <select
                    className={inputClass}
                    value={angle}
                    onChange={(e) =>
                      setAngle(e.target.value as (typeof MESSAGING_ANGLES)[number])
                    }
                  >
                    {MESSAGING_ANGLES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Format</label>
                  <select
                    className={inputClass}
                    value={format}
                    onChange={(e) => setFormat(e.target.value as CreativeFormat)}
                  >
                    {CREATIVE_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {FORMAT_SPECS[f].label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">
                    {FORMAT_SPECS[format].note}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <SectionLabel>Image</SectionLabel>
                <p className="mt-1 text-xs text-slate-400">
                  Website photos stay as they were scanned. AI concepts are mood
                  images — not catalog shots of this product.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseAiImage(false);
                    }}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium",
                      !useAiImage
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    Website photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseAiImage(true)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium",
                      useAiImage
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    AI concept
                  </button>
                </div>
                {!useAiImage && (
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {orderedImages.length === 0 ? (
                      <p className="col-span-full text-sm text-slate-500">
                        No photos were found for this product. Use an AI concept
                        instead — it will be labeled as generated.
                      </p>
                    ) : (
                      orderedImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setSourceId(img.id)}
                          className={cn(
                            "border-2",
                            sourceId === img.id
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
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary text-sm disabled:opacity-60"
                  disabled={
                    busy !== null ||
                    (!useAiImage && orderedImages.length > 0 && !sourceId)
                  }
                  onClick={() => void handleGenerateLayout()}
                >
                  {busy === "layout" ? "Generating layout…" : "Generate layout"}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm disabled:opacity-60"
                  disabled={busy !== null}
                  onClick={() => void handleGenerateConcepts()}
                >
                  {busy === "concepts"
                    ? "Generating concepts…"
                    : "Generate 10 concepts"}
                </button>
              </div>
              {plan === "free" && (
                <p className="mt-2 text-xs text-slate-400">
                  Generation requires Pro. Free accounts will be asked to upgrade.
                </p>
              )}
            </section>
          )}

          {offering && copy && (
            <section className="grid gap-8 lg:grid-cols-2">
              <div>
                <SectionLabel>Preview</SectionLabel>
                <div className="mt-3">
                  <CreativeLayout
                    format={format}
                    imageUrl={previewUrl}
                    headline={copy.headline}
                    description={copy.description}
                    cta={copy.cta}
                    imageLabel={previewLabel}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <SectionLabel>Copy</SectionLabel>
                <div>
                  <label className={labelClass}>Hook</label>
                  <input
                    className={inputClass}
                    value={copy.hook}
                    onChange={(e) => setCopy({ ...copy, hook: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Headline</label>
                  <input
                    className={inputClass}
                    value={copy.headline}
                    onChange={(e) =>
                      setCopy({ ...copy, headline: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={copy.description}
                    onChange={(e) =>
                      setCopy({ ...copy, description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>CTA</label>
                  <input
                    className={inputClass}
                    value={copy.cta}
                    onChange={(e) => setCopy({ ...copy, cta: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Creative concept</label>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={copy.creativeConcept}
                    onChange={(e) =>
                      setCopy({ ...copy, creativeConcept: e.target.value })
                    }
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Recommended platforms:{" "}
                  {copy.platforms.map((p) => PLATFORM_LABEL[p]).join(", ") || "—"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={createAdHref} className="btn-primary text-sm">
                    Create ad
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={exportCopy}
                  >
                    Export copy
                  </button>
                  {useAiImage && aiImage && (
                    <a
                      href={aiImage.url}
                      download
                      className="btn-secondary text-sm"
                    >
                      Download concept image
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}

          {concepts && (
            <section>
              <SectionLabel>Ten concept angles</SectionLabel>
              <p className="mt-1 text-sm text-slate-500">
                Original copy for this product. Not competitor ads and not live
                creatives. Apply one to the layout, then create the ad.
              </p>
              {concepts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No concepts were returned. Try again — nothing was invented to
                  fill the grid.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {concepts.map((card) => (
                    <article
                      key={card.angle}
                      className="flex flex-col border border-slate-200 bg-white p-5"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {card.angle}
                      </p>
                      <h3 className="mt-2 text-base font-semibold text-slate-900">
                        {card.headline}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">{card.hook}</p>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                        {card.description}
                      </p>
                      <p className="mt-3 text-xs text-slate-400">
                        CTA · {card.cta}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {card.creativeConcept}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => applyConcept(card)}
                        >
                          Use in layout
                        </button>
                        <Link
                          href={`/ad-studio?site=${siteId}&offering=${offering?.id}&angle=${encodeURIComponent(card.angle)}`}
                          className="btn-primary text-xs"
                        >
                          Create ad
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}

export default function CreativeStudioPage() {
  return (
    <Suspense>
      <CreativeStudioInner />
    </Suspense>
  );
}
