"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeoIssue, SeoPageFacts } from "@/lib/seo/types";
import type { GeoComponent } from "@/lib/types";
import { cn, scoreTone, toneBar, toneText } from "@/lib/utils";

interface PageDetail {
  id: string;
  url: string;
  score: number;
  issues: SeoIssue[];
  facts: SeoPageFacts;
  content: {
    headings: { h1: string[]; h2: string[]; h3: string[] };
    faqs: { question: string; answer: string }[];
    jsonLdTypes: string[];
    mainContentPreview: string;
  } | null;
  geo: { overall: number; components: GeoComponent[] } | null;
}

const SEVERITY_TONE = {
  critical: "critical",
  warning: "warning",
  info: "neutral",
} as const;

function Field({
  label,
  value,
  ok,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  ok?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <div className="mt-0.5 break-words text-sm text-slate-700">{value}</div>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {ok != null && (
        <Badge tone={ok ? "positive" : "warning"}>{ok ? "OK" : "Review"}</Badge>
      )}
    </div>
  );
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function PageDetailInner() {
  const params = useParams<{ pageAuditId: string }>();
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site") ?? "";
  const [data, setData] = useState<PageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId || !params.pageAuditId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/sites/${siteId}/seo/pages/${params.pageAuditId}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!cancelled) setError(json.error ?? "Failed to load page audit.");
        return;
      }
      if (!cancelled) setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, params.pageAuditId]);

  const facts = data?.facts;

  return (
    <AppShell
      title={data ? pathOf(data.url) : "Page audit"}
      subtitle={data?.url}
      breadcrumb="SEO Autopilot"
      actions={
        <>
          <Link
            href={`/seo/pages?site=${siteId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All pages
          </Link>
          {data && (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open page
            </a>
          )}
        </>
      }
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <Skeleton className="h-96" />}

      {data && facts && (
        <FadeIn className="space-y-6">
          {/* Score header */}
          <Card className="flex flex-wrap items-center gap-6 p-6">
            <div>
              <p className="text-sm font-medium text-slate-500">SEO Score</p>
              <p
                className={cn(
                  "mt-1 text-4xl font-bold tracking-tight",
                  toneText[scoreTone(data.score)]
                )}
              >
                {data.score}
                <span className="text-lg text-slate-300">/100</span>
              </p>
            </div>
            <div className="h-12 w-px bg-slate-100" />
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <p className="text-red-600">
                {data.issues.filter((i) => i.severity === "critical").length}{" "}
                critical
              </p>
              <p className="text-amber-600">
                {data.issues.filter((i) => i.severity === "warning").length}{" "}
                warnings
              </p>
              <p className="text-slate-500">
                {data.issues.filter((i) => i.severity === "info").length}{" "}
                suggestions
              </p>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Search optimization */}
            <Card className="p-6">
              <h2 className="font-semibold text-slate-900">Search optimization</h2>
              <div className="mt-2 divide-y divide-slate-100">
                <Field
                  label="Title"
                  value={facts.title ?? <Badge tone="critical">Missing</Badge>}
                  ok={Boolean(
                    facts.title && facts.titleLength >= 15 && facts.titleLength <= 60
                  )}
                  hint={facts.title ? `${facts.titleLength} characters` : undefined}
                />
                <Field
                  label="Meta description"
                  value={
                    facts.metaDescription ?? <Badge tone="warning">Missing</Badge>
                  }
                  ok={Boolean(
                    facts.metaDescription &&
                      facts.metaDescriptionLength >= 50 &&
                      facts.metaDescriptionLength <= 165
                  )}
                  hint={
                    facts.metaDescription
                      ? `${facts.metaDescriptionLength} characters`
                      : undefined
                  }
                />
                <Field
                  label="H1"
                  value={facts.h1 ?? <Badge tone="warning">Missing</Badge>}
                  ok={facts.h1Count === 1}
                  hint={facts.h1Count > 1 ? `${facts.h1Count} H1s on page` : undefined}
                />
                <Field
                  label="Canonical"
                  value={facts.canonicalUrl ?? "Not declared"}
                  ok={facts.canonicalState === "self"}
                  hint={
                    facts.canonicalState === "internal-other"
                      ? "Canonicalized to another page"
                      : facts.canonicalState === "external"
                        ? "Points to a different domain"
                        : undefined
                  }
                />
              </div>
            </Card>

            {/* Technical */}
            <Card className="p-6">
              <h2 className="font-semibold text-slate-900">Technical</h2>
              <div className="mt-2 divide-y divide-slate-100">
                <Field
                  label="Indexability"
                  value={
                    facts.noindex
                      ? `noindex (${facts.metaRobots})`
                      : facts.metaRobots ?? "No robots directive (indexable)"
                  }
                  ok={!facts.noindex}
                />
                <Field
                  label="HTTP status"
                  value={facts.statusCode ?? "Unknown"}
                  ok={facts.statusCode != null && facts.statusCode < 300}
                />
                <Field
                  label="Fetch time (during crawl)"
                  value={
                    facts.loadTimeMs != null
                      ? `${(facts.loadTimeMs / 1000).toFixed(1)}s`
                      : "—"
                  }
                  ok={facts.loadTimeMs != null ? facts.loadTimeMs <= 3000 : undefined}
                />
                <Field
                  label="Internal links"
                  value={`${facts.incomingInternalLinks} incoming · ${facts.internalLinksOut} outgoing`}
                  ok={facts.incomingInternalLinks > 0}
                />
                <Field
                  label="Structured data"
                  value={
                    facts.schemaTypes.length > 0
                      ? facts.schemaTypes.join(", ")
                      : "None"
                  }
                  ok={facts.schemaTypes.length > 0}
                />
              </div>
            </Card>
          </div>

          {/* Content */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Content</h2>
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
              <p>
                <span className="font-semibold">{facts.wordCount}</span> words
              </p>
              <p>
                <span className="font-semibold">{facts.h2Count}</span> H2 headings
              </p>
              <p>
                <span className="font-semibold">
                  {data.content?.faqs.length ?? 0}
                </span>{" "}
                FAQs detected
              </p>
              <p>
                <span className="font-semibold">{facts.imagesMissingAlt}</span> of{" "}
                <span className="font-semibold">{facts.imageCount}</span> images
                missing alt text
              </p>
            </div>
            {data.content?.mainContentPreview && (
              <p className="mt-4 border-l-2 border-slate-200 pl-4 text-sm leading-relaxed text-slate-500">
                {data.content.mainContentPreview.slice(0, 500)}…
              </p>
            )}
          </Card>

          {/* Issues */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">
              Issues ({data.issues.length})
            </h2>
            {data.issues.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">
                No issues found on this page.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.issues.map((issue, i) => (
                  <li key={`${issue.id}-${i}`} className="flex items-start gap-2.5">
                    <Badge tone={SEVERITY_TONE[issue.severity]}>
                      {issue.severity}
                    </Badge>
                    <span className="text-sm text-slate-600">{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* GEO bridge */}
          {data.geo && (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">GEO analysis</h2>
                <p className="text-sm text-slate-500">
                  Site GEO Score{" "}
                  <span
                    className={cn(
                      "font-bold",
                      toneText[scoreTone(data.geo.overall)]
                    )}
                  >
                    {data.geo.overall}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                GEO scoring is site-level — these components come from the same
                scan this page audit was built from.
              </p>
              <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {data.geo.components.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs text-slate-500">
                      {c.name}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          toneBar[scoreTone(c.score)]
                        )}
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-600">
                      {c.score}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}

export default function SeoPageDetailPage() {
  return (
    <Suspense>
      <PageDetailInner />
    </Suspense>
  );
}
