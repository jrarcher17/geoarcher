"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LeadShell, LeadUpgradeGate } from "@/components/leads/LeadShell";
import { EmptyState } from "@/components/os/primitives";
import { Skeleton } from "@/components/ui/skeleton";

interface ProspectRow {
  id: string;
  companyName: string;
  domain: string;
  status: string;
  score: number | null;
  adOpportunityScore: number | null;
  campaignId: string;
  campaignName: string;
}

export default function ProspectsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ProspectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const accessRes = await fetch("/api/leads/access", { cache: "no-store" });
      if (accessRes.status === 401) {
        window.location.href = "/login?next=/leads/prospects";
        return;
      }
      const access = await accessRes.json().catch(() => ({}));
      if (cancelled) return;
      if (!access.allowed) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      const res = await fetch("/api/leads/prospects", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not load prospects.");
        return;
      }
      setRows(json.prospects);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === false) {
    return (
      <LeadShell title="Prospects" subtitle="Find businesses that need better advertising.">
        <LeadUpgradeGate />
      </LeadShell>
    );
  }

  return (
    <LeadShell
      title="Prospects"
      subtitle="Businesses found for advertising — scan a site, then create campaigns in Ad Studio."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {allowed === null || rows === null ? (
        <Skeleton className="h-48" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No prospects yet"
          body="Start a campaign to find businesses you can advertise."
          actionHref="/leads/new"
          actionLabel="Find Prospects"
        />
      ) : (
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Opportunity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/leads/prospects/${p.id}`}
                      className="font-medium text-slate-900 underline-offset-4 hover:underline"
                    >
                      {p.companyName}
                    </Link>
                    <p className="text-xs text-slate-400">{p.domain}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {p.adOpportunityScore ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.status}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/leads/${p.campaignId}`}
                      className="text-slate-600 underline-offset-4 hover:underline"
                    >
                      {p.campaignName}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </LeadShell>
  );
}
