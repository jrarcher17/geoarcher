"use client";

import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AutopilotCard } from "@/components/seo/AutopilotCard";
import { EmptyState, SectionLabel } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";

const MONITOR = [
  "Crawls the site on a schedule",
  "Re-runs SEO and GEO analysis",
  "Finds new opportunities",
  "Tracks rankings when DataForSEO is connected",
  "Models AI visibility after each scan",
  "Watches competitor pages you already added",
];

const AUTO = [
  { label: "Technical SEO", mode: "ON" },
  { label: "Structured Data", mode: "ON" },
  { label: "Internal Linking", mode: "ON" },
  { label: "Metadata", mode: "ON" },
  { label: "Entity Signals", mode: "ON" },
  { label: "Content Suggestions", mode: "REVIEW" },
  { label: "New Pages", mode: "REVIEW" },
  { label: "Major Content Changes", mode: "REVIEW" },
] as const;

function AutopilotInner() {
  const { sites, siteId, upgradeRequired, loading } = useSeoAutopilot();

  if (loading) return <Skeleton className="h-64" />;

  if (sites.length === 0) {
    return (
      <EmptyState
        title="Add a website before starting Autopilot"
        body="GEO Archer needs a site to crawl, monitor, and improve."
        actionHref="/sites"
        actionLabel="Add Website"
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-slate-200 bg-white p-6">
          <SectionLabel>Monitor</SectionLabel>
          <p className="mt-2 text-sm text-slate-500">
            Always on when Autopilot is enabled. GEO Archer finds work; it does
            not rewrite your site unattended.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {MONITOR.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
        <section className="border border-slate-200 bg-white p-6">
          <SectionLabel>Autopilot policy</SectionLabel>
          <p className="mt-2 text-sm text-slate-500">
            GEO Archer never makes major website changes without your approval.
          </p>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {AUTO.map((row) => (
              <li key={row.label} className="flex items-center justify-between py-2">
                <span className="text-slate-700">{row.label}</span>
                <span
                  className={
                    row.mode === "ON"
                      ? "text-xs font-semibold text-emerald-700"
                      : "text-xs font-semibold text-amber-700"
                  }
                >
                  {row.mode}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            ON means GEO Archer will measure and queue work. REVIEW means a
            person approves drafts before anything is published.
          </p>
        </section>
      </div>

      {upgradeRequired ? (
        <div className="border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Autopilot is included with Pro
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Upgrade to run continuous crawls, audits, and ranking checks.
          </p>
          <Link href="/settings?tab=billing" className="btn-primary mt-4 inline-block">
            See Billing
          </Link>
        </div>
      ) : (
        siteId && <AutopilotCard siteId={siteId} />
      )}

      <section className="border border-slate-200 bg-white p-6">
        <SectionLabel>Optimization layer</SectionLabel>
        <h2 className="mt-2 text-base font-semibold text-slate-900">
          Improve visibility without rebuilding the site
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          GEO Archer can add an intelligent layer — structured data, metadata,
          and entity signals — on top of the site you already have.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Script", "Simple install for supported optimizations. Available via the site GEO layer."],
            ["CMS Integration", "WordPress, Shopify, Webflow. Coming soon — not connected."],
            ["Edge / Server", "Deeper HTML changes at the host. Coming soon — not connected."],
          ].map(([title, body]) => (
            <div key={title} className="border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>
        {siteId && (
          <Link
            href={`/sites/${siteId}`}
            className="mt-4 inline-block text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Review Changes on this site
          </Link>
        )}
      </section>
    </div>
  );
}

export default function AutopilotPage() {
  return (
    <AppShell
      title="GEO Autopilot"
      subtitle="Continuously improve your website's search and AI visibility."
    >
      <Suspense fallback={<Skeleton className="h-64" />}>
        <AutopilotInner />
      </Suspense>
    </AppShell>
  );
}
