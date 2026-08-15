"use client";

import { useEffect, useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import type { SeoOverviewDto } from "@/lib/seo/types";
import { downloadSeoReportPdf } from "@/lib/seo-report-pdf";
import { downloadSiteReportPdf } from "@/lib/site-report-pdf";
import { useInsights, type SiteInsight } from "@/lib/useInsights";
import { formatDate, hostOf, scoreTone } from "@/lib/utils";

export default function ReportsPage() {
  const { data, error, loading } = useInsights();
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [seoBySite, setSeoBySite] = useState<Record<string, SeoOverviewDto>>({});

  const ready = (data?.sites ?? []).filter((s) => s.analysis);

  // SEO Autopilot overviews (Pro sites with a completed audit only) — failures
  // simply hide the SEO parts of the card.
  useEffect(() => {
    if (ready.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ready.map(async (s) => {
          try {
            const res = await fetch(`/api/sites/${s.siteId}/seo`, {
              cache: "no-store",
            });
            if (!res.ok) return null;
            const overview = (await res.json()) as SeoOverviewDto;
            if (overview.audit?.overallScore == null) return null;
            return [s.siteId, overview] as const;
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) {
        setSeoBySite(
          Object.fromEntries(entries.filter((e): e is NonNullable<typeof e> => e !== null))
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function download(key: string, build: () => void) {
    setDownloading(key);
    try {
      await new Promise((r) => setTimeout(r, 0));
      build();
      setDownloaded(key);
      setTimeout(() => setDownloaded(null), 2000);
    } finally {
      setDownloading(null);
    }
  }

  function buttonLabel(key: string, label: string): string {
    if (downloading === key) return "Generating…";
    if (downloaded === key) return "Downloaded!";
    return label;
  }

  return (
    <AppShell
      title="Reports"
      subtitle="Shareable PDF summaries of each site's AI visibility and SEO health — built for stakeholders, not crawlers."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <Skeleton className="h-64" />}

      {data &&
        (ready.length === 0 ? (
          <Card className="p-10 text-center">
            <FileBarChart className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">No reports yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Reports become available once a site has a completed analysis.
            </p>
          </Card>
        ) : (
          <FadeIn className="grid gap-4 md:grid-cols-2">
            {ready.map((s: SiteInsight) => {
              const seo = seoBySite[s.siteId];
              const geoKey = `geo:${s.siteId}`;
              const seoKey = `seo:${s.siteId}`;
              return (
                <Card key={s.siteId} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{hostOf(s.url)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Last analysis{" "}
                        {s.latestScan ? formatDate(s.latestScan.createdAt) : "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Badge tone={scoreTone(s.analysis!.geoOverall)}>
                        GEO {s.analysis!.geoOverall}
                      </Badge>
                      {seo?.audit?.overallScore != null && (
                        <Badge tone={scoreTone(seo.audit.overallScore)}>
                          SEO {seo.audit.overallScore}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500">
                    {s.analysis!.businessSummary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={downloading !== null}
                      onClick={() =>
                        void download(geoKey, () => downloadSiteReportPdf(s))
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      {buttonLabel(geoKey, "GEO report")}
                    </Button>
                    {seo && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={downloading !== null}
                        onClick={() =>
                          void download(seoKey, () => downloadSeoReportPdf(seo))
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                        {buttonLabel(seoKey, "SEO report")}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </FadeIn>
        ))}
    </AppShell>
  );
}
