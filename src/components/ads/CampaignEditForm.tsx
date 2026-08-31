"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { rankImagesForOffering } from "@/lib/advertising/image-pick";
import { SectionLabel } from "@/components/os/primitives";
import { cn } from "@/lib/utils";

interface SiteImage {
  id: string;
  url: string;
  alt: string | null;
  pageUrl?: string | null;
  offeringId?: string | null;
}

interface Creative {
  url?: string;
  alt?: string | null;
  siteImageId?: string | null;
  source?: string;
}

export interface CampaignEditPayload {
  name: string;
  budgetDailyCents?: number;
  landingPage: string;
  creative: Creative | null;
  copy: Record<string, unknown>;
}

const inputClass =
  "mt-1 w-full border border-slate-200 px-3 py-2 text-sm text-slate-900";

export function CampaignEditForm({
  platform,
  name,
  budgetDailyCents,
  landingPage,
  offering,
  siteId,
  published,
  creative,
  copy,
  busy,
  onCancel,
  onSave,
}: {
  platform: string;
  name: string;
  budgetDailyCents: number | null;
  landingPage: string | null;
  offering: { id: string; name: string } | null;
  siteId: string | null;
  published: boolean;
  creative: Creative | null;
  copy: {
    headlines?: string[];
    descriptions?: string[];
    primaryText?: string;
    advertiser?: string;
    headline?: string;
    description?: string;
    prompt?: string;
    answer?: string;
    intents?: string[];
  };
  busy: boolean;
  onCancel: () => void;
  onSave: (payload: CampaignEditPayload) => void;
}) {
  const usesImage = platform === "META" || platform === "AI_CHAT";
  const [editName, setEditName] = useState(name);
  const [editBudget, setEditBudget] = useState(
    budgetDailyCents ? String(budgetDailyCents / 100) : ""
  );
  const [editLanding, setEditLanding] = useState(landingPage ?? "");
  const [editCreative, setEditCreative] = useState<Creative | null>(creative);
  const [primaryText, setPrimaryText] = useState(copy.primaryText ?? "");
  const [headline, setHeadline] = useState(
    copy.headline ?? copy.headlines?.[0] ?? ""
  );
  const [description, setDescription] = useState(
    copy.description ?? copy.descriptions?.[0] ?? ""
  );
  const [advertiser, setAdvertiser] = useState(copy.advertiser ?? "");
  const [headlines, setHeadlines] = useState((copy.headlines ?? []).join("\n"));
  const [descriptions, setDescriptions] = useState(
    (copy.descriptions ?? []).join("\n")
  );
  const [library, setLibrary] = useState<SiteImage[]>([]);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    fetch(`/api/sites/${siteId}/intelligence`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (cancelled || !json?.images) return;
        setLibrary(json.images as SiteImage[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const ranked = useMemo(() => {
    if (!offering) return library;
    return rankImagesForOffering(library, offering);
  }, [library, offering]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((img) =>
      `${img.alt ?? ""} ${img.url} ${img.pageUrl ?? ""}`.toLowerCase().includes(q)
    );
  }, [ranked, query]);

  const visible = showAll ? filtered : filtered.slice(0, 12);
  const selectedId =
    editCreative?.siteImageId ??
    library.find((img) => img.url === editCreative?.url)?.id ??
    null;

  async function addFromUrl(url: string) {
    if (!siteId) {
      setEditCreative({ url, alt: null, source: "UPLOAD" });
      return;
    }
    setAdding(true);
    setLocalError(null);
    try {
      const res = await fetch("/api/me/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          offeringId: offering?.id ?? null,
          url,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add that image.");
      setLibrary((prev) =>
        prev.some((i) => i.id === json.id) ? prev : [json, ...prev]
      );
      setEditCreative({
        url: json.url,
        alt: json.alt,
        siteImageId: json.id,
        source: "SITE_IMAGE",
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not add that image.");
    } finally {
      setAdding(false);
    }
  }

  async function uploadFile(file: File) {
    if (!siteId) {
      setLocalError("This campaign has no website, so uploads need an image URL.");
      return;
    }
    setAdding(true);
    setLocalError(null);
    try {
      const form = new FormData();
      form.set("siteId", siteId);
      if (offering?.id) form.set("offeringId", offering.id);
      form.set("file", file);
      const res = await fetch("/api/me/images", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not upload that image.");
      setLibrary((prev) =>
        prev.some((i) => i.id === json.id) ? prev : [json, ...prev]
      );
      setEditCreative({
        url: json.url,
        alt: json.alt,
        siteImageId: json.id,
        source: "UPLOAD",
      });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Could not upload that image."
      );
    } finally {
      setAdding(false);
    }
  }

  function submit() {
    const trimmed = editName.trim();
    const dollars = editBudget.trim() ? Number(editBudget) : null;
    if (!trimmed) {
      setLocalError("Campaign name is required.");
      return;
    }
    if (dollars != null && (!Number.isFinite(dollars) || dollars <= 0)) {
      setLocalError("Daily budget must be a number greater than zero.");
      return;
    }
    const nextCopy: Record<string, unknown> = {};
    if (platform === "META") {
      nextCopy.primaryText = primaryText;
      nextCopy.headline = headline;
      nextCopy.description = description;
    } else if (platform === "AI_CHAT") {
      nextCopy.advertiser = advertiser;
      nextCopy.headline = headline;
      nextCopy.description = description;
    } else {
      nextCopy.headlines = headlines.split("\n");
      nextCopy.descriptions = descriptions.split("\n");
    }
    onSave({
      name: trimmed,
      budgetDailyCents:
        dollars != null ? Math.round(dollars * 100) : undefined,
      landingPage: editLanding.trim(),
      creative: usesImage ? editCreative : creative,
      copy: nextCopy,
    });
  }

  return (
    <section className="border border-slate-200 bg-white p-6">
      <SectionLabel>Edit campaign</SectionLabel>
      {published && (
        <p className="mt-2 text-sm text-amber-700">
          This updates the campaign in GEO Archer. A live ad on the platform is
          not rewritten.
        </p>
      )}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            Name
          </span>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            Daily budget (USD)
          </span>
          <input
            type="number"
            min="1"
            step="1"
            value={editBudget}
            onChange={(e) => setEditBudget(e.target.value)}
            className={inputClass}
            placeholder="Optional"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            Landing page
          </span>
          <input
            value={editLanding}
            onChange={(e) => setEditLanding(e.target.value)}
            className={inputClass}
            placeholder="https://"
          />
        </label>
      </div>

      {usesImage && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Ad image
          </p>
          {editCreative?.url ? (
            <div className="mt-2 flex items-start gap-3">
              <Image
                src={editCreative.url}
                alt={editCreative.alt ?? ""}
                width={160}
                height={100}
                unoptimized
                className="h-24 w-36 border border-slate-200 bg-slate-50 object-cover"
              />
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setEditCreative(null)}
              >
                Remove image
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No image on this ad.</p>
          )}

          {siteId && (
            <>
              <input
                className={`${inputClass} mt-3`}
                placeholder="Search site photos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {visible.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {visible.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() =>
                        setEditCreative({
                          url: img.url,
                          alt: img.alt,
                          siteImageId: img.id,
                          source: "SITE_IMAGE",
                        })
                      }
                      className={cn(
                        "border-2 transition",
                        selectedId === img.id
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
              )}
              {filtered.length > 12 && !showAll && (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-slate-600 underline underline-offset-2"
                  onClick={() => setShowAll(true)}
                >
                  Show {filtered.length - 12} more site photos
                </button>
              )}
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className={`${inputClass} mt-0 min-w-[12rem] flex-1`}
              placeholder="https://… product image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary text-sm disabled:opacity-60"
              disabled={adding || !imageUrl.trim()}
              onClick={() => {
                const next = imageUrl.trim();
                if (!next) return;
                void addFromUrl(next).then(() => setImageUrl(""));
              }}
            >
              Use URL
            </button>
            <label className="btn-secondary cursor-pointer text-sm">
              Upload
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={adding}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadFile(file);
                }}
              />
            </label>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4">
        {platform === "META" && (
          <>
            <label className="text-sm">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Primary text
              </span>
              <textarea
                value={primaryText}
                onChange={(e) => setPrimaryText(e.target.value)}
                className={`${inputClass} min-h-[88px]`}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  Headline
                </span>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="text-sm">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  Description
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          </>
        )}
        {platform === "AI_CHAT" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Advertiser
              </span>
              <input
                value={advertiser}
                onChange={(e) => setAdvertiser(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Headline
              </span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputClass} min-h-[72px]`}
              />
            </label>
          </div>
        )}
        {platform === "GOOGLE" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Headlines (one per line)
              </span>
              <textarea
                value={headlines}
                onChange={(e) => setHeadlines(e.target.value)}
                className={`${inputClass} min-h-[120px] font-mono text-xs`}
              />
            </label>
            <label className="text-sm">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Descriptions (one per line)
              </span>
              <textarea
                value={descriptions}
                onChange={(e) => setDescriptions(e.target.value)}
                className={`${inputClass} min-h-[120px] font-mono text-xs`}
              />
            </label>
          </div>
        )}
      </div>

      {localError && <p className="mt-3 text-sm text-red-600">{localError}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary text-sm disabled:opacity-60"
          disabled={busy || adding}
          onClick={submit}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
