"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/cards/FadeIn";
import { ScoreCard } from "@/components/cards/ScoreCard";
import { hostOf } from "@/lib/utils";
import type { ScanResult } from "@/lib/types";

const STEPS = [
  { key: "QUEUED", label: "Queued" },
  { key: "CRAWLING", label: "Crawling pages" },
  { key: "ANALYZING", label: "AI analysis" },
  { key: "COMPLETE", label: "Report ready" },
] as const;

/**
 * Scan progress view. Regular scans hand off to Site Intelligence when
 * complete; competitor (benchmark) scans render a compact summary here.
 */
export function ScanDashboard({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/scans/${scanId}`, { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        const data: ScanResult = await res.json();
        if (cancelled) return;
        setScan(data);
        if (data.status === "COMPLETE" && !data.benchmarkScanId) {
          router.replace(`/sites/${data.siteId}/intelligence`);
          return;
        }
        if (["QUEUED", "CRAWLING", "ANALYZING"].includes(data.status)) {
          timer = setTimeout(poll, 2000);
        }
      } catch (err) {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "Failed to load scan.");
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanId, router]);

  async function runScanAgain() {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/scans/${scanId}/rescan`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.scanId) {
        router.push(`/scan/${data.scanId}`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not start scan.");
      router.push(`/scan/${data.scanId}`);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Could not start scan.");
      setRetrying(false);
    }
  }

  const isRunning =
    !scan || ["QUEUED", "CRAWLING", "ANALYZING"].includes(scan.status);
  const stepIndex = scan
    ? STEPS.findIndex((s) => s.key === scan.status)
    : 0;
  const title = scan?.siteUrl ? hostOf(scan.siteUrl) : "Scan";

  if (fetchError) {
    return (
      <AppShell title="Scan unavailable" breadcrumb="Scans" subtitle={fetchError}>
        <Card className="p-8 text-center">
          <p className="text-red-600">{fetchError}</p>
          <Link href="/dashboard" className="btn-primary mt-6 inline-block">
            Back to dashboard
          </Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={title}
      breadcrumb="Scans"
      subtitle={
        scan?.benchmarkScanId
          ? "Competitor benchmark scan"
          : "Crawling and analyzing — you'll be redirected to Site Intelligence when it's ready."
      }
      live={isRunning}
    >
      {isRunning && (
        <FadeIn>
          <Card className="p-10 text-center">
            <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-sky-500" />
            <p className="text-lg font-semibold text-slate-900">
              {!scan || scan.status === "QUEUED"
                ? "Queued…"
                : scan.status === "CRAWLING"
                  ? `Crawling — ${scan.pagesCrawled} page${scan.pagesCrawled === 1 ? "" : "s"} so far`
                  : "Running AI analysis"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              {scan?.status === "CRAWLING" && scan.pagesCrawled === 0
                ? "Starting the browser and loading the first page — up to a minute."
                : "Usually one to three minutes. You can close this tab — the scan keeps running. Check Scans when you come back."}
            </p>

            <ol className="mx-auto mt-8 flex max-w-md items-center justify-between gap-2">
              {STEPS.map((step, i) => (
                <li key={step.key} className="flex flex-1 flex-col items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      i < stepIndex
                        ? "bg-emerald-500 text-white"
                        : i === stepIndex
                          ? "bg-sky-500 text-white"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      i <= stepIndex ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </FadeIn>
      )}

      {scan?.status === "FAILED" && (
        <FadeIn>
          <Card className="border-red-200 bg-red-50/60 p-10 text-center">
            <Badge tone="critical">Scan failed</Badge>
            <p className="mt-4 text-sm text-red-600">{scan.error}</p>
            <p className="mt-2 text-sm text-slate-500">
              Old scan links go stale after a dev server restart — run a fresh
              scan instead of refreshing this page.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={runScanAgain} disabled={retrying}>
                <RefreshCw className="h-4 w-4" />
                {retrying ? "Starting…" : "Run scan again"}
              </Button>
              <Link href="/dashboard" className="btn-secondary">
                Back to dashboard
              </Link>
            </div>
          </Card>
        </FadeIn>
      )}

      {scan?.status === "COMPLETE" && scan.benchmarkScanId && scan.analysis && (
        <FadeIn className="flex flex-col gap-4">
          <Link
            href={`/scan/${scan.benchmarkScanId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to your site&apos;s comparison
          </Link>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ScoreCard
              label="GEO Score"
              score={scan.analysis.geoScore.overall}
              showGrade
              explanation="This competitor's generative engine optimization."
            />
            <ScoreCard
              label="AI Understanding"
              score={scan.analysis.understanding.confidence}
              explanation="How clearly AI parses what this competitor does."
            />
            <ScoreCard
              label="Pages crawled"
              score={scan.pagesCrawled}
              explanation="Competitor crawls use a smaller page budget."
            />
          </div>
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">
              What AI thinks they do
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {scan.analysis.understanding.businessSummary}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scan.analysis.semanticMap.subtopics.slice(0, 10).map((s) => (
                <Badge key={s} tone="neutral">
                  {s}
                </Badge>
              ))}
            </div>
          </Card>
        </FadeIn>
      )}
    </AppShell>
  );
}
