"use client";

import Link from "next/link";
import { RefreshCw, Rocket, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { useSeoAutopilot } from "@/lib/useSeoAutopilot";
import { hostOf } from "@/lib/utils";

type Autopilot = ReturnType<typeof useSeoAutopilot>;

function SiteSelect({ autopilot }: { autopilot: Autopilot }) {
  if (autopilot.sites.length <= 1) return null;
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span className="shrink-0 font-medium text-slate-500">Site</span>
      <select
        value={autopilot.siteId}
        onChange={(e) => autopilot.setSiteId(e.target.value)}
        className="min-w-[10rem] rounded-none border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
      >
        {[...autopilot.sites]
          .sort((a, b) => hostOf(a.url).localeCompare(hostOf(b.url)))
          .map((s) => (
            <option key={s.siteId} value={s.siteId}>
              {hostOf(s.url)}
            </option>
          ))}
      </select>
    </label>
  );
}

/**
 * Shared frame for all SEO Autopilot pages: site selector, Pro gate,
 * empty states, and the audit-running banner.
 */
export function SeoShell({
  title,
  subtitle,
  autopilot,
  children,
}: {
  title: string;
  subtitle?: string;
  autopilot: Autopilot;
  children: React.ReactNode;
}) {
  const { overview, error, upgradeRequired, loading, auditRunning } = autopilot;

  let body: React.ReactNode;

  if (upgradeRequired) {
    body = (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-sky-500" />
        <p className="mt-3 text-lg font-semibold text-slate-900">
          SEO Autopilot is a Pro feature
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Upgrade to unlock search visibility scoring, technical SEO audits,
          page-level analysis, and prioritized growth opportunities — all built
          from the crawl you already run.
        </p>
        <div className="mt-5">
          <Link href="/settings?tab=billing">
            <Button>Upgrade to Pro</Button>
          </Link>
        </div>
      </Card>
    );
  } else if (error) {
    body = <p className="text-sm text-red-600">{error}</p>;
  } else if (loading) {
    body = (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  } else if (autopilot.sites.length === 0) {
    body = (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <Rocket className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 font-medium text-slate-700">No sites yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Add and scan a website to start using SEO Autopilot.
        </p>
        <div className="mt-5">
          <Link href="/sites">
            <Button variant="secondary">Go to Sites</Button>
          </Link>
        </div>
      </Card>
    );
  } else if (overview && !overview.latestScanId) {
    body = (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <Rocket className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 font-medium text-slate-700">No completed scan yet</p>
        <p className="mt-1 text-sm text-slate-400">
          SEO Autopilot analyzes the pages from your existing site scan — run a
          scan first and results will appear here.
        </p>
        <div className="mt-5">
          <Link href={`/sites/${overview.siteId}`}>
            <Button variant="secondary">Open site</Button>
          </Link>
        </div>
      </Card>
    );
  } else {
    body = (
      <>
        {auditRunning && (
          <div className="mb-5 flex items-center gap-3 border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
            Analyzing crawled pages and generating opportunities — results
            update automatically.
          </div>
        )}
        {overview?.audit?.error && (
          <div className="mb-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {overview.audit.error}
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <AppShell
      title={title}
      subtitle={subtitle}
      breadcrumb="SEO Autopilot"
      actions={
        !upgradeRequired && (
          <>
            <SiteSelect autopilot={autopilot} />
            {overview?.latestScanId && (
              <Button
                variant="secondary"
                size="sm"
                disabled={auditRunning}
                onClick={() => void autopilot.runAudit()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {auditRunning ? "Auditing…" : "Re-run audit"}
              </Button>
            )}
          </>
        )
      }
    >
      {body}
    </AppShell>
  );
}
