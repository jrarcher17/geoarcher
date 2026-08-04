"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScanForm } from "@/components/ScanForm";

interface DashboardSite {
  siteId: string;
  url: string;
  addedAt: string;
  latestScan: {
    id: string;
    status: string;
    createdAt: string;
    geoOverall: number | null;
    understanding: number | null;
  } | null;
}

export default function DashboardPage() {
  const [sites, setSites] = useState<DashboardSite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/me/sites");
      if (res.status === 401) {
        if (!cancelled) window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (!cancelled) setError(j.error ?? "Failed to load dashboard.");
        return;
      }
      const data = await res.json();
      if (!cancelled) setSites(data.sites);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Your sites</h1>
      <p className="mt-1 text-slate-500">
        Scans you run while signed in appear here. Anonymous scans still work
        from the home page.
      </p>

      <div className="mt-8 card p-6">
        <ScanForm />
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {sites && sites.length === 0 && (
        <p className="mt-8 text-slate-400">No saved sites yet — analyze one above.</p>
      )}

      {sites && sites.length > 0 && (
        <ul className="mt-8 flex flex-col gap-3">
          {sites.map((s) => (
            <li key={s.siteId}>
              <Link
                href={s.latestScan ? `/scan/${s.latestScan.id}` : `/`}
                className="card block p-4 transition hover:border-sky-200 hover:shadow-md"
              >
                <p className="font-medium break-all text-slate-900">{s.url}</p>
                {s.latestScan ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Latest scan · {s.latestScan.status}
                    {s.latestScan.geoOverall != null &&
                      ` · GEO ${s.latestScan.geoOverall}`}
                    {s.latestScan.understanding != null &&
                      ` · Understanding ${s.latestScan.understanding}`}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">No scans yet</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
