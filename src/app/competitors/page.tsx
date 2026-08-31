"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { EmptyState, ErrorBanner, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { hostOf } from "@/lib/utils";

interface OfferingOpt {
  id: string;
  name: string;
  kind: string;
}

interface CompetitorRow {
  id: string;
  name: string;
  website: string | null;
  category: string | null;
  rationale: string;
  source: "MENTIONED" | "AI_RECOMMENDATION" | "MANUAL";
  similarProducts: string[];
  searchTerms: string[];
  customerProblems: string[];
  customerIntent: string[];
  siteId: string;
  siteUrl: string;
  companyName: string | null;
  offering: { id: string; name: string; kind: string } | null;
}

interface SiteOpt {
  id: string;
  url: string;
  companyName: string | null;
  intelligenceReady: boolean;
  offerings: OfferingOpt[];
}

const SOURCE_LABEL: Record<CompetitorRow["source"], string> = {
  MENTIONED: "Named on your site",
  AI_RECOMMENDATION: "AI recommendation",
  MANUAL: "Added by you",
};

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<CompetitorRow[] | null>(null);
  const [sites, setSites] = useState<SiteOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [discovering, setDiscovering] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    siteId: "",
    name: "",
    website: "",
    offeringId: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/me/competitors", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load.");
    setCompetitors(json.competitors);
    setSites(json.sites);
    setForm((prev) => ({
      ...prev,
      siteId: prev.siteId || json.sites[0]?.id || "",
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to load.");
        setCompetitors([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const visible = useMemo(() => {
    if (!competitors) return [];
    return competitors.filter((c) => siteFilter === "ALL" || c.siteId === siteFilter);
  }, [competitors, siteFilter]);

  const readySites = sites.filter((s) => s.intelligenceReady);
  const formSite = sites.find((s) => s.id === form.siteId);

  async function discover() {
    setDiscovering(true);
    setError(null);
    try {
      const res = await fetch("/api/me/competitors/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          siteFilter !== "ALL" ? { siteId: siteFilter } : {}
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Discovery failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed.");
    } finally {
      setDiscovering(false);
    }
  }

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/me/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: form.siteId,
          name: form.name,
          website: form.website || undefined,
          offeringId: form.offeringId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add competitor.");
      setForm((prev) => ({ ...prev, name: "", website: "", offeringId: "" }));
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add competitor.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/me/competitors/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Could not remove.");
      return;
    }
    setCompetitors((prev) => prev?.filter((c) => c.id !== id) ?? null);
  }

  return (
    <AppShell
      title="Competitors"
      subtitle="Brands in the same landscape as your scanned products. Names are recommendations — not verified advertisers."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="btn-secondary text-sm"
            disabled={sites.length === 0}
          >
            Add competitor
          </button>
          <button
            type="button"
            onClick={() => void discover()}
            className="btn-primary text-sm"
            disabled={discovering || readySites.length === 0}
          >
            {discovering ? "Finding…" : "Find competitors"}
          </button>
        </div>
      }
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

      {!competitors && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      )}

      {competitors && sites.length === 0 && (
        <EmptyState
          title="Add a product first"
          body="Competitors are suggested from your products and industry — we do not invent brands from nothing."
          actionHref="/products"
          actionLabel="Add a product"
        />
      )}

      {competitors && sites.length > 0 && showAdd && (
        <form
          onSubmit={(e) => void addCompetitor(e)}
          className="mb-8 border border-slate-200 bg-white p-5 sm:p-6"
        >
          <SectionLabel>Add a competitor</SectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-600">
              Website
              <select
                required
                value={form.siteId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, siteId: e.target.value, offeringId: "" }))
                }
                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName || hostOf(s.url)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Brand name
              <input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="CurrentBody"
                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-sm text-slate-600">
              Website <span className="text-slate-400">(optional)</span>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://"
                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-sm text-slate-600">
              Related product <span className="text-slate-400">(optional)</span>
              <select
                value={form.offeringId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, offeringId: e.target.value }))
                }
                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">None</option>
                {(formSite?.offerings ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary text-sm" disabled={adding}>
              {adding ? "Adding…" : "Save competitor"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {competitors && sites.length > 0 && (
        <FadeIn>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>
              {visible.length === 1
                ? "1 competitor"
                : `${visible.length} competitors`}
            </SectionLabel>
            {sites.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSiteFilter("ALL")}
                  className={
                    siteFilter === "ALL"
                      ? "bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      : "border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                  }
                >
                  All sites
                </button>
                {sites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSiteFilter(s.id)}
                    className={
                      siteFilter === s.id
                        ? "bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                        : "border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                    }
                  >
                    {s.companyName || hostOf(s.url)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visible.length === 0 && (
            <div className="border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                No competitors yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Find brands from your scanned products, or add one by name. We
                will not invent ad counts or claim they are advertising.
              </p>
              {readySites.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void discover()}
                  disabled={discovering}
                  className="btn-primary mt-6 text-sm"
                >
                  {discovering ? "Finding…" : "Find competitors"}
                </button>
              ) : (
                <Link href="/products" className="btn-primary mt-6 inline-block text-sm">
                  Add a product
                </Link>
              )}
            </div>
          )}

          {visible.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((c) => (
                <article
                  key={c.id}
                  className="flex flex-col border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">
                      {c.name}
                    </h2>
                    <span className="shrink-0 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {SOURCE_LABEL[c.source]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    vs {c.companyName || hostOf(c.siteUrl)}
                    {c.offering ? ` · ${c.offering.name}` : ""}
                    {c.category ? ` · ${c.category}` : ""}
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                    {c.rationale}
                  </p>
                  {c.similarProducts.length > 0 && (
                    <p className="mt-3 text-xs text-slate-500">
                      Similar products: {c.similarProducts.join(" · ")}
                    </p>
                  )}
                  {c.searchTerms.length > 0 && (
                    <p className="mt-1 text-xs text-slate-400">
                      Search terms (AI recommendation): {c.searchTerms.join(", ")}
                    </p>
                  )}
                  {c.website && (
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 text-xs text-slate-500 underline-offset-2 hover:underline"
                    >
                      {c.website}
                    </a>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/ad-intelligence?competitor=${c.id}`}
                      className="btn-secondary text-sm"
                    >
                      Analyze Ads
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      className="btn-secondary text-sm"
                    >
                      Remove
                    </button>
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
