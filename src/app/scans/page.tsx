"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Eye } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/cards/FadeIn";
import { hostOf } from "@/lib/utils";

interface ScanRow {
  id: string;
  siteId: string;
  siteUrl: string;
  status: string;
  error: string | null;
  pagesCrawled: number;
  createdAt: string;
  finishedAt: string | null;
  geoOverall: number | null;
  understanding: number | null;
}

function statusTone(status: string) {
  if (status === "COMPLETE") return "positive" as const;
  if (status === "FAILED") return "critical" as const;
  return "warning" as const;
}

export default function ScansPage() {
  const [scans, setScans] = useState<ScanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/me/scans", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (!cancelled) setError(j.error ?? "Failed to load scans.");
        return;
      }
      const json = await res.json();
      if (!cancelled) setScans(json.scans);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      title="Scans"
      subtitle="Every crawl you've run, newest first."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!scans && !error && <Skeleton className="h-64" />}

      {scans && (
        <FadeIn>
          <Card className="overflow-hidden">
            {scans.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-400">
                No scans yet — start one from the Dashboard or Sites page.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {scans.map((s) => (
                  <li key={s.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition hover:bg-slate-50/70">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/sites/${s.siteId}`}
                            className="font-medium text-slate-900 hover:text-sky-600"
                          >
                            {hostOf(s.siteUrl)}
                          </Link>
                          <Badge tone={statusTone(s.status)}>
                            {s.status.toLowerCase()}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(s.createdAt).toLocaleString()} ·{" "}
                          {s.pagesCrawled} pages
                          {s.geoOverall != null ? ` · GEO ${s.geoOverall}` : ""}
                          {s.understanding != null
                            ? ` · Understanding ${s.understanding}`
                            : ""}
                        </p>
                        {s.error && (
                          <p className="mt-1 truncate text-xs text-red-500">
                            {s.error}
                          </p>
                        )}
                      </div>
                      <Link
                        href={
                          s.status === "COMPLETE"
                            ? `/sites/${s.siteId}`
                            : `/scan/${s.id}`
                        }
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600"
                        aria-label={
                          s.status === "COMPLETE" ? "Open report" : "View scan"
                        }
                        title={
                          s.status === "COMPLETE" ? "Open report" : "View scan"
                        }
                      >
                        {s.status === "COMPLETE" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </FadeIn>
      )}
    </AppShell>
  );
}
