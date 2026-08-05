"use client";

import { useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { downloadSiteReportPdf } from "@/lib/site-report-pdf";
import { useInsights, type SiteInsight } from "@/lib/useInsights";
import { formatDate, hostOf, scoreTone } from "@/lib/utils";

export default function ReportsPage() {
  const { data, error, loading } = useInsights();
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(site: SiteInsight) {
    setDownloading(site.siteId);
    try {
      await new Promise((r) => setTimeout(r, 0));
      downloadSiteReportPdf(site);
      setDownloaded(site.siteId);
      setTimeout(() => setDownloaded(null), 2000);
    } finally {
      setDownloading(null);
    }
  }

  const ready = (data?.sites ?? []).filter((s) => s.analysis);

  return (
    <AppShell
      title="Reports"
      subtitle="Shareable PDF summaries of each site's AI visibility — built for stakeholders, not crawlers."
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
            {ready.map((s) => (
              <Card key={s.siteId} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{hostOf(s.url)}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Last analysis{" "}
                      {s.latestScan ? formatDate(s.latestScan.createdAt) : "—"}
                    </p>
                  </div>
                  <Badge tone={scoreTone(s.analysis!.geoOverall)}>
                    GEO {s.analysis!.geoOverall}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500">
                  {s.analysis!.businessSummary}
                </p>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={downloading === s.siteId}
                    onClick={() => void download(s)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloading === s.siteId
                      ? "Generating…"
                      : downloaded === s.siteId
                        ? "Downloaded!"
                        : "Download PDF"}
                  </Button>
                </div>
              </Card>
            ))}
          </FadeIn>
        ))}
    </AppShell>
  );
}
