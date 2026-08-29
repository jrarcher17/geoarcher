"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Globe, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { ScanForm } from "@/components/ScanForm";
import { getPlanLimits } from "@/lib/plans";
import { useInsights } from "@/lib/useInsights";
import { formatDate, hostOf } from "@/lib/utils";

export default function SitesPage() {
  const router = useRouter();
  const { data, error, loading } = useInsights();
  const [addOpen, setAddOpen] = useState(false);
  const siteLimit = data ? getPlanLimits(data.plan).sites : null;
  const atSiteLimit =
    siteLimit != null && (data?.sites.length ?? 0) >= siteLimit;
  const addSiteTitle = atSiteLimit
    ? data?.plan === "free"
      ? "Free includes 1 site. Upgrade to Pro to add more."
      : `Your plan includes ${siteLimit} sites.`
    : "Add a site";

  async function removeSite(siteId: string, url: string) {
    if (!confirm(`Remove ${url} and all its scans?`)) return;
    const res = await fetch(`/api/me/sites/${siteId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Could not remove site.");
      return;
    }
    router.refresh();
    window.location.reload();
  }

  return (
    <>
      <AppShell
        title="Sites"
        subtitle="Every website you've connected. One scan builds the advertising intelligence behind your campaigns."
        actions={
          atSiteLimit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled title={addSiteTitle}>
                <Plus className="h-4 w-4" />
                Add a site
              </Button>
              {data?.plan === "free" && (
                <Link href="/settings?tab=billing">
                  <Button variant="secondary">Upgrade to Pro</Button>
                </Link>
              )}
            </div>
          ) : (
            <Button onClick={() => setAddOpen(true)} disabled={!data}>
              <Plus className="h-4 w-4" />
              Add a site
            </Button>
          )
        }
      >
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        )}

        {data && (
          <FadeIn className="flex flex-col gap-6">
            {data.sites.length === 0 ? (
              <Card className="p-10 text-center">
                <Globe className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-medium text-slate-700">No sites yet</p>
                <p className="mt-1 text-sm text-slate-400">
                  Add a URL and GEO Archer scans it, understands the business, and
                  finds what&apos;s worth advertising.
                </p>
                <Button className="mt-6" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add a site
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.sites.map((s) => {
                  const scanning = ["QUEUED", "CRAWLING", "ANALYZING"].includes(
                    s.latestScan?.status ?? ""
                  );
                  const intel = s.intelligence;
                  const title = intel.companyName || hostOf(s.url);
                  return (
                    <Card
                      key={s.siteId}
                      className="group relative p-5 transition hover:border-sky-200 hover:shadow-md"
                    >
                      <Link href={`/sites/${s.siteId}/intelligence`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                              {title}
                              <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-sky-500" />
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              {s.url}
                            </p>
                            {intel.industry && (
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {intel.industry}
                              </p>
                            )}
                          </div>
                          {scanning ? (
                            <Badge tone="info">Scanning…</Badge>
                          ) : s.latestScan?.status === "FAILED" ? (
                            <Badge tone="critical">Last scan failed</Badge>
                          ) : intel.status === "RUNNING" ? (
                            <Badge tone="info">Analyzing…</Badge>
                          ) : intel.status === "FAILED" ? (
                            <Badge tone="critical">Analysis failed</Badge>
                          ) : intel.status === "COMPLETE" ? (
                            <Badge tone="positive">Ready for ads</Badge>
                          ) : s.latestScan?.status === "COMPLETE" ? (
                            <Badge tone="neutral">Scan complete</Badge>
                          ) : (
                            <Badge tone="neutral">Not scanned</Badge>
                          )}
                        </div>

                        {intel.status === "COMPLETE" ? (
                          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div>
                              <dt className="text-[11px] text-slate-400">
                                Offerings
                              </dt>
                              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                                {intel.offerings}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11px] text-slate-400">
                                Images
                              </dt>
                              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                                {intel.images}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11px] text-slate-400">
                                Opportunities
                              </dt>
                              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                                {intel.opportunities}
                              </dd>
                            </div>
                          </dl>
                        ) : intel.status === "RUNNING" || scanning ? (
                          <p className="mt-4 text-sm text-sky-700">
                            {scanning
                              ? "Scan in progress — advertising intelligence follows."
                              : "Extracting advertising intelligence…"}
                          </p>
                        ) : s.latestScan?.status === "COMPLETE" ? (
                          <p className="mt-4 text-sm text-slate-500">
                            Scan finished. Open the site to review advertising
                            intelligence.
                          </p>
                        ) : (
                          <p className="mt-4 text-sm text-slate-400">
                            No completed scan yet.
                          </p>
                        )}

                        <p className="mt-4 text-xs text-slate-400">
                          Last scan{" "}
                          {s.latestScan
                            ? formatDate(s.latestScan.createdAt)
                            : "never"}
                        </p>
                      </Link>
                      {data.plan !== "free" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void removeSite(s.siteId, s.url);
                          }}
                          className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${s.url}`}
                          title="Remove site"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </FadeIn>
        )}
      </AppShell>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          title="Add a site"
          description="Enter a URL to scan. GEO Archer identifies your business, products, services, images and advertising opportunities."
          className="max-w-md"
        >
          <ScanForm
            layout="stacked"
            submitLabel="Start scan"
            onSuccess={() => setAddOpen(false)}
          />
          <p className="mt-4 text-xs text-slate-400">
            Scans are saved to your workspace.
            {data && data.plan !== "free"
              ? " Pro: use Remove on a site card or the site page header."
              : " Upgrade to Pro to remove sites from your workspace."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
