"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { EmptyState, ErrorBanner, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { hostOf } from "@/lib/utils";

interface ProductRow {
  id: string;
  kind: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  price: string | null;
  url: string | null;
  image: { url: string; alt: string | null } | null;
  category: string | null;
  benefits: string[];
  targetAudience: string[];
  siteId: string;
  siteUrl: string;
  companyName: string | null;
  industry: string | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"ALL" | "PRODUCT" | "SERVICE">("ALL");

  const load = useCallback(async () => {
    const res = await fetch("/api/me/products", { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load.");
    setProducts((await res.json()).products);
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

  return (
    <AppShell
      title="Products & Services"
      subtitle="What we found on your websites — the units you can advertise."
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
      {!products && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {products && products.length === 0 && (
        <EmptyState
          title="Scan a website to find what to advertise"
          body="GEO Archer extracts products and services from a completed scan. Nothing here is invented."
          actionHref="/sites"
          actionLabel="Add a website"
        />
      )}

      {products && products.length > 0 && (
        <FadeIn>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>
              {products.length} found on your scanned sites
            </SectionLabel>
            <div className="flex gap-2">
              {(
                [
                  ["ALL", "All"],
                  ["PRODUCT", "Products"],
                  ["SERVICE", "Services"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  className={
                    kind === id
                      ? "bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      : "border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {products.filter((p) => kind === "ALL" || p.kind === kind).length ===
            0 && (
            <p className="mb-4 text-sm text-slate-500">
              No {kind === "PRODUCT" ? "products" : "services"} in this view.
              Try All.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products
              .filter((p) => kind === "ALL" || p.kind === kind)
              .map((p) => (
              <article
                key={p.id}
                className="flex flex-col border border-slate-200 bg-white"
              >
                {p.image ? (
                  <Image
                    src={p.image.url}
                    alt={p.image.alt ?? p.name}
                    width={480}
                    height={240}
                    unoptimized
                    className="h-40 w-full border-b border-slate-100 bg-slate-50 object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
                    No product image on the site
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">
                      {p.name}
                    </h2>
                    <span className="shrink-0 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {p.kind === "PRODUCT" ? "Product" : "Service"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {p.companyName || hostOf(p.siteUrl)}
                    {p.category ? ` · ${p.category}` : p.industry ? ` · ${p.industry}` : ""}
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                    {p.description}
                  </p>
                  {p.targetAudience.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      {p.targetAudience.join(" · ")}
                    </p>
                  )}
                  {p.price && (
                    <p className="mt-3 text-sm font-medium text-slate-900">{p.price}</p>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/products/${p.id}`}
                      className="btn-secondary text-sm"
                    >
                      View
                    </Link>
                    <Link
                      href={`/ad-intelligence?offering=${p.id}`}
                      className="btn-secondary text-sm"
                    >
                      Analyze Ads
                    </Link>
                    <Link
                      href={`/ad-studio?site=${p.siteId}&offering=${p.id}`}
                      className="btn-primary text-sm"
                    >
                      Create Ad
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </FadeIn>
      )}
    </AppShell>
  );
}
