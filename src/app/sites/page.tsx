"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Globe, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { ScanForm } from "@/components/ScanForm";
import { useInsights } from "@/lib/useInsights";
import { formatDate, gradeFor, hostOf, scoreTone } from "@/lib/utils";

export default function SitesPage() {
  const router = useRouter();
  const { data, error, loading } = useInsights();

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
    <AppShell
      title="Sites"
      subtitle="Every site you track, with its current AI readiness."
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
          <Card className="p-6">
            <p className="mb-3 text-sm font-semibold text-slate-900">
              Add a site
            </p>
            <ScanForm />
          </Card>

          {data.sites.length === 0 ? (
            <Card className="p-10 text-center">
              <Globe className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No sites yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Analyze a URL above to start tracking it.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.sites.map((s) => {
                const running = ["QUEUED", "CRAWLING", "ANALYZING"].includes(
                  s.latestScan?.status ?? ""
                );
                return (
                  <Card key={s.siteId} className="group relative p-5 transition hover:border-sky-200 hover:shadow-md">
                    <Link href={`/sites/${s.siteId}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                            {hostOf(s.url)}
                            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-sky-500" />
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {s.url}
                          </p>
                        </div>
                        {running ? (
                          <Badge tone="info">Scanning…</Badge>
                        ) : s.latestScan?.status === "FAILED" ? (
                          <Badge tone="critical">Last scan failed</Badge>
                        ) : s.analysis ? (
                          <Badge tone={scoreTone(s.analysis.geoOverall)}>
                            Grade {gradeFor(s.analysis.geoOverall)}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Not scanned</Badge>
                        )}
                      </div>

                      {s.analysis ? (
                        <div className="mt-4 flex flex-col gap-3">
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>GEO Score</span>
                              <span className="font-mono text-slate-600">
                                {s.analysis.geoOverall}
                              </span>
                            </div>
                            <Progress value={s.analysis.geoOverall} className="mt-1" />
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>AI Understanding</span>
                              <span className="font-mono text-slate-600">
                                {s.analysis.understanding}
                              </span>
                            </div>
                            <Progress
                              value={s.analysis.understanding}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-400">
                          No completed analysis yet.
                        </p>
                      )}

                      <p className="mt-4 text-xs text-slate-400">
                        Last scan{" "}
                        {s.latestScan ? formatDate(s.latestScan.createdAt) : "never"}
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeSite(s.siteId, s.url)}
                      className="absolute bottom-4 right-4 rounded-lg p-2 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      aria-label={`Remove ${s.url}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}
