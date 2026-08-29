"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Target } from "lucide-react";
import { LeadShell, LeadUpgradeGate } from "@/components/leads/LeadShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, type Tone } from "@/lib/utils";
import { StrategyCta } from "@/components/strategy/StrategyCta";

interface CampaignRow {
  id: string;
  name: string;
  industry: string;
  location: string | null;
  targetCount: number;
  mode: string;
  status: string;
  prospectCount?: number;
  createdAt: string;
}

interface DashboardPayload {
  campaigns: CampaignRow[];
  quota: { used: number; limit: number; remaining: number };
  funnel: Record<string, number>;
  configured: { inngest: boolean; apollo: boolean; resend: boolean };
}

function statusTone(status: string): Tone {
  if (status === "RUNNING") return "info";
  if (status === "COMPLETE") return "positive";
  if (status === "FAILED" || status === "CANCELLED") return "critical";
  return "neutral";
}

const FUNNEL_KEYS = [
  ["FOUND", "Found"],
  ["ANALYZING", "Analyzing"],
  ["QUALIFIED", "Qualified"],
  ["CONTACTED", "Contacted"],
  ["REPLIED", "Replied"],
] as const;

export default function LeadsDashboardPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const accessRes = await fetch("/api/leads/access", { cache: "no-store" });
      if (accessRes.status === 401) {
        window.location.href = "/login?next=/leads";
        return;
      }
      const access = await accessRes.json().catch(() => ({}));
      if (cancelled) return;
      if (!access.allowed) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      const res = await fetch("/api/leads/campaigns", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not load campaigns.");
        return;
      }
      setData(json);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LeadShell
      title="Get more customers from AI & advertising"
      subtitle="Find businesses that need better advertising — or ask GEO Archer to build the strategy for you."
      actions={
        allowed ? (
          <Link href="/leads/new">
            <Button>
              <Plus className="h-4 w-4" />
              Find Prospects
            </Button>
          </Link>
        ) : undefined
      }
    >
      {allowed === null && (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
      {allowed === false && (
        <div className="space-y-6">
          <LeadUpgradeGate />
          <StrategyCta />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {allowed && data && (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Monthly quota
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {data.quota.used}
                <span className="text-sm font-medium text-slate-400">
                  {" "}
                  / {data.quota.limit}
                </span>
              </p>
              <Progress
                className="mt-3"
                value={(data.quota.used / Math.max(1, data.quota.limit)) * 100}
                toned={false}
              />
              <p className="mt-2 text-xs text-slate-500">
                {data.quota.remaining} outreach leads remaining this month.
                Unreachable or empty sites we skip do not count.
              </p>
            </Card>
            <Card className="p-5 md:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Pipeline
              </p>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {FUNNEL_KEYS.map(([key, label]) => (
                  <div key={key} className="rounded-none border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-xl font-bold text-slate-900">
                      {data.funnel[key] ?? 0}
                    </p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {!data.configured.apollo && (
            <p className="rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              APOLLO_API_KEY is not set — company search will fail until it is.
            </p>
          )}

          {data.campaigns.length === 0 ? (
            <Card className="p-10 text-center">
              <Target className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No campaigns yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Pick an industry and location. We find companies, score their
                advertising opportunity, and draft outreach.
              </p>
              <Link href="/leads/new">
                <Button className="mt-6">
                  <Plus className="h-4 w-4" />
                  Create a campaign
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-none border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Campaign</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Mode</th>
                    <th className="px-4 py-3 font-medium">Prospects</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/leads/${c.id}`}
                          className="font-medium text-slate-900 hover:text-violet-700"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {c.industry}
                          {c.location ? ` · ${c.location}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.mode === "AUTO_SEND" ? "Auto-send" : "Approve first"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.prospectCount ?? 0} / {c.targetCount}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <StrategyCta />
        </div>
      )}
    </LeadShell>
  );
}
