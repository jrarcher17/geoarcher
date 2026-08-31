"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { hostOf } from "@/lib/utils";

interface ProductIntelligence {
  id: string;
  kind: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  price: string | null;
  url: string | null;
  category: string | null;
  benefits: string[];
  features: string[];
  targetAudience: string[];
  cta: string | null;
  location: string | null;
  images: { id: string; url: string; alt: string | null }[];
  siteId: string;
  siteUrl: string;
  companyName: string | null;
  brand: string | null;
  industry: string | null;
  companyDescription: string | null;
}

export default function ProductIntelligencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [product, setProduct] = useState<ProductIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/me/products/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Not found.");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setProduct(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AppShell
      title={product?.name ?? "Product Intelligence"}
      subtitle={
        product
          ? `${product.companyName || hostOf(product.siteUrl)}${product.category ? ` · ${product.category}` : ""}`
          : "Facts from the page you scanned or entered."
      }
      breadcrumb="Products"
      actions={
        product ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/products" className="btn-secondary text-sm">
              All products
            </Link>
            <Link
              href={`/ad-intelligence?offering=${product.id}`}
              className="btn-secondary text-sm"
            >
              Analyze Ads
            </Link>
            <Link
              href={`/ad-studio?site=${product.siteId}&offering=${product.id}`}
              className="btn-primary text-sm"
            >
              Create Ad
            </Link>
          </div>
        ) : null
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!product && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}

      {product && (
        <FadeIn className="flex flex-col gap-8">
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {product.kind === "PRODUCT" ? "Product" : "Service"}
                </span>
                {product.category && (
                  <span className="text-xs text-slate-500">{product.category}</span>
                )}
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-700">
                {product.description}
              </p>
              <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Company
                  </dt>
                  <dd className="mt-0.5 text-slate-900">
                    {product.companyName || hostOf(product.siteUrl)}
                  </dd>
                </div>
                {product.brand && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Brand
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{product.brand}</dd>
                  </div>
                )}
                {product.price && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Price on site
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{product.price}</dd>
                  </div>
                )}
                {product.cta && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Website CTA
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{product.cta}</dd>
                  </div>
                )}
                {product.location && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Location
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{product.location}</dd>
                  </div>
                )}
                {product.url && (
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Landing page
                    </dt>
                    <dd className="mt-0.5">
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-900 underline-offset-2 hover:underline"
                      >
                        {product.url}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="grid gap-4">
              {product.images[0] ? (
                <Image
                  src={product.images[0].url}
                  alt={product.images[0].alt ?? product.name}
                  width={640}
                  height={400}
                  unoptimized
                  className="h-56 w-full border border-slate-200 bg-slate-50 object-cover"
                />
              ) : (
                <div className="flex h-56 items-center justify-center border border-dashed border-slate-300 bg-white text-sm text-slate-400">
                  No product image on the website
                </div>
              )}
              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.slice(1, 5).map((img) => (
                    <Image
                      key={img.id}
                      src={img.url}
                      alt={img.alt ?? ""}
                      width={160}
                      height={100}
                      unoptimized
                      className="h-16 w-full border border-slate-200 bg-slate-50 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="border border-slate-200 bg-white p-5">
              <SectionLabel>Benefits</SectionLabel>
              {product.benefits.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {product.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  None stated on the website.
                </p>
              )}
            </div>
            <div className="border border-slate-200 bg-white p-5">
              <SectionLabel>Features</SectionLabel>
              {product.features.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {product.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  None stated on the website.
                </p>
              )}
            </div>
            <div className="border border-slate-200 bg-white p-5">
              <SectionLabel>Audience named on site</SectionLabel>
              {product.targetAudience.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {product.targetAudience.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  The site does not name a target audience.
                </p>
              )}
            </div>
          </section>
        </FadeIn>
      )}
    </AppShell>
  );
}
