"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Eye, Globe } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionChecklist } from "@/components/cards/ActionChecklist";
import { FadeIn } from "@/components/cards/FadeIn";
import {
  GenerateActionButton,
  kindForRecommendation,
} from "@/components/cards/GenerateAction";
import { ScoreCard } from "@/components/cards/ScoreCard";
import { TrendChart } from "@/components/cards/TrendChart";
import { useInsights } from "@/lib/useInsights";
import { formatDate, hostOf } from "@/lib/utils";

export default function DashboardPage() {
  const { data, error, loading } = useInsights();

  const stats = useMemo(() => {
    const sites = data?.sites ?? [];
    const analyzed = sites.filter((s) => s.analysis);
    const avg = (pick: (s: (typeof analyzed)[number]) => number) =>
      analyzed.length
        ? Math.round(analyzed.reduce((sum, s) => sum + pick(s), 0) / analyzed.length)
        : null;

    const avgGeo = avg((s) => s.analysis!.geoOverall);
    const avgUnderstanding = avg((s) => s.analysis!.understanding);
    const visibilityScores = sites
      .filter((s) => s.visibility)
      .map((s) => s.visibility!.overall);
    const avgVisibility = visibilityScores.length
      ? Math.round(
          visibilityScores.reduce((a, b) => a + b, 0) / visibilityScores.length
        )
      : null;

    // Merge histories into one average-per-scan-date trend (use the site with most history as spine)
    const richest = [...sites].sort(
      (a, b) => b.history.length - a.history.length
    )[0];
    const trend =
      richest?.history.map((h) => ({
        date: formatDate(h.date),
        geo: h.geo,
        understanding: h.understanding,
      })) ?? [];

    const topActions = sites
      .flatMap((s) =>
        s.analysis
          ? s.analysis.recommendations.map((r) => ({
              rec: r,
              site: s,
              scanId: data?.scanIds[s.siteId] ?? null,
            }))
          : []
      )
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[a.rec.impact] - rank[b.rec.impact];
      })
      .slice(0, 5);

    const topWins = topActions.slice(0, 3);
    const topIssues = sites
      .flatMap((s) =>
        s.analysis
          ? s.analysis.problems.map((p) => ({ ...p, site: hostOf(s.url) }))
          : []
      )
      .slice(0, 3);

    return {
      total: sites.length,
      avgGeo,
      avgUnderstanding,
      avgVisibility,
      trend,
      trendSiteLabel: richest ? hostOf(richest.url) : null,
      topActions,
      topWins,
      topIssues,
      running: sites.filter((s) =>
        ["QUEUED", "CRAWLING", "ANALYZING"].includes(s.latestScan?.status ?? "")
      ).length,
    };
  }, [data]);

  return (
    <AppShell
      title="Dashboard"
      subtitle="Your AI visibility at a glance — what's working, what's broken, and what to do next."
      live
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {data && (
        <FadeIn className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ScoreCard
              label="Portfolio GEO Score"
              score={stats.avgGeo}
              showGrade
              explanation="Average across your analyzed sites. 75+ means AI can cite you confidently."
            />
            <ScoreCard
              label="AI Understanding"
              score={stats.avgUnderstanding}
              explanation="How well assistants grasp what you do, for whom, and where."
            />
            <ScoreCard
              label="AI Visibility"
              score={stats.avgVisibility}
              suffix="%"
              icon={<Eye className="h-4 w-4" />}
              explanation="Modeled likelihood of being surfaced by ChatGPT, Claude, Gemini & co."
            />
            <ScoreCard
              label="Sites tracked"
              score={stats.total}
              icon={<Globe className="h-4 w-4" />}
              explanation={
                stats.running > 0
                  ? `${stats.running} scan${stats.running === 1 ? "" : "s"} running now.`
                  : "All scans idle. Recrawl after shipping changes."
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Visibility trend</CardTitle>
                <CardDescription>
                  {stats.trendSiteLabel
                    ? `Scores over time — ${stats.trendSiteLabel}`
                    : "Scores over time"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={stats.trend}
                  series={[
                    { key: "geo", label: "GEO Score" },
                    { key: "understanding", label: "AI Understanding" },
                  ]}
                />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card className="flex-1 p-5">
                <p className="text-sm font-semibold text-slate-900">Top wins</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {stats.topWins.map(({ rec, site }) => (
                    <li
                      key={`${site.siteId}-${rec.title}`}
                      className="flex items-start gap-2 text-sm text-slate-600"
                    >
                      <Badge tone="positive" className="mt-0.5 shrink-0">
                        {rec.impact}
                      </Badge>
                      <span>
                        {rec.title}
                        <span className="text-slate-400"> · {hostOf(site.url)}</span>
                      </span>
                    </li>
                  ))}
                  {stats.topWins.length === 0 && (
                    <li className="text-sm text-slate-400">
                      Run a scan to surface wins.
                    </li>
                  )}
                </ul>
                <Link
                  href="/recommendations"
                  className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline"
                >
                  All recommendations →
                </Link>
              </Card>
              <Card className="flex-1 p-5">
                <p className="text-sm font-semibold text-slate-900">Top issues</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {stats.topIssues.map((p) => (
                    <li
                      key={`${p.site}-${p.issue}`}
                      className="flex items-start gap-2 text-sm text-slate-600"
                    >
                      <Badge tone="warning" className="mt-0.5 shrink-0">
                        issue
                      </Badge>
                      <span>
                        {p.issue}
                        <span className="text-slate-400"> · {p.site}</span>
                      </span>
                    </li>
                  ))}
                  {stats.topIssues.length === 0 && (
                    <li className="text-sm text-slate-400">
                      No blocking issues found.
                    </li>
                  )}
                </ul>
                <Link
                  href="/sites"
                  className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline"
                >
                  Review sites →
                </Link>
              </Card>
            </div>
          </div>

          {stats.topActions.length > 0 && (
            <ActionChecklist
              actions={stats.topActions.map(({ rec, site, scanId }, i) => ({
                id: `${site.siteId}-${i}`,
                title: `${rec.title} — ${hostOf(site.url)}`,
                impact: rec.impact,
                effort: rec.effort,
                detail: rec.why,
                cta: scanId ? (
                  <GenerateActionButton
                    scanId={scanId}
                    kind={kindForRecommendation(rec)}
                    topic={rec.title}
                  />
                ) : undefined,
              }))}
            />
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}
