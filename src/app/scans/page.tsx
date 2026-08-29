"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Eye, Trash2 } from "lucide-react";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadScans = useCallback(async () => {
    const res = await fetch("/api/me/scans", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to load scans.");
      return;
    }
    const json = await res.json();
    setScans(json.scans);
    setError(null);
  }, []);

  useEffect(() => {
    void loadScans();
  }, [loadScans]);

  async function deleteScan(scan: ScanRow) {
    if (["QUEUED", "CRAWLING", "ANALYZING"].includes(scan.status)) {
      alert("Wait for this scan to finish before deleting it.");
      return;
    }
    if (!confirm(`Delete this scan for ${hostOf(scan.siteUrl)}? This cannot be undone.`)) {
      return;
    }
    setDeletingId(scan.id);
    try {
      const res = await fetch(`/api/scans/${scan.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not delete scan.");
      await loadScans();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete scan.");
    } finally {
      setDeletingId(null);
    }
  }

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
                            href={`/sites/${s.siteId}/intelligence`}
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
                        </p>
                        {s.error && (
                          <p className="mt-1 truncate text-xs text-red-500">
                            {s.error}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Link
                          href={
                            s.status === "COMPLETE"
                              ? `/sites/${s.siteId}/intelligence`
                              : `/scan/${s.id}`
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600"
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
                        <button
                          type="button"
                          disabled={deletingId === s.id}
                          aria-label="Delete scan"
                          title="Delete scan"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          onClick={() => void deleteScan(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
