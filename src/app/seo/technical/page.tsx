"use client";

import { Suspense, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { SeoShell } from "@/components/seo/SeoShell";
import { SEO_CATEGORY_LABELS, type SeoSiteCheck } from "@/lib/seo/types";
import { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { cn } from "@/lib/utils";

function StatusIcon({ status }: { status: SeoSiteCheck["status"] }) {
  if (status === "pass")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50">
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      </span>
    );
  if (status === "warn")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
      </span>
    );
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50">
      <X className="h-3.5 w-3.5 text-red-600" />
    </span>
  );
}

function CheckRow({ check }: { check: SeoSiteCheck }) {
  const [open, setOpen] = useState(false);
  const expandable = check.affectedUrls.length > 0;
  return (
    <div className="px-5 py-3.5">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 text-left",
          !expandable && "cursor-default"
        )}
      >
        <StatusIcon status={check.status} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{check.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{check.detail}</p>
        </div>
        {expandable &&
          (open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ))}
      </button>
      {open && (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto border-l-2 border-slate-100 pl-4">
          {check.affectedUrls.map((url) => (
            <li key={url} className="truncate text-xs text-slate-500">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-sky-600 hover:underline"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SeoTechnicalInner() {
  const autopilot = useSeoAutopilot();
  const { overview } = autopilot;
  const checks = overview?.audit?.siteChecks ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, SeoSiteCheck[]>();
    for (const check of checks) {
      const label =
        SEO_CATEGORY_LABELS[check.category as keyof typeof SEO_CATEGORY_LABELS] ??
        check.category;
      map.set(label, [...(map.get(label) ?? []), check]);
    }
    // Groups with failures first
    return [...map.entries()].sort((a, b) => {
      const bad = (list: SeoSiteCheck[]) =>
        list.filter((c) => c.status !== "pass").length;
      return bad(b[1]) - bad(a[1]);
    });
  }, [checks]);

  const passing = checks.filter((c) => c.status === "pass").length;

  return (
    <SeoShell
      title="Technical SEO"
      subtitle="Site-wide checks computed from the pages your existing scan already crawled — indexability, metadata, links, structure, and schema."
      autopilot={autopilot}
    >
      {overview?.audit && (
        <FadeIn className="space-y-5">
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 p-5 text-sm">
            <p className="font-medium text-slate-700">
              {passing} of {checks.length} checks passing
            </p>
            <p className="text-slate-400">
              Based on {overview.audit.pagesCrawled} crawled pages · every finding
              is observed data, not an estimate.
            </p>
          </Card>

          {grouped.map(([label, list]) => (
            <div key={label}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </h2>
              <Card className="divide-y divide-slate-100 p-0">
                {list.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </Card>
            </div>
          ))}
        </FadeIn>
      )}
    </SeoShell>
  );
}

export default function SeoTechnicalPage() {
  return (
    <Suspense>
      <SeoTechnicalInner />
    </Suspense>
  );
}
