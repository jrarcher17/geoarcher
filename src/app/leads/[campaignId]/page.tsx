"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeadShell, LeadUpgradeGate } from "@/components/leads/LeadShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { qualifyThreshold } from "@/lib/leads/qualify";
import { formatDate, type Tone } from "@/lib/utils";

interface ProspectRow {
  id: string;
  companyName: string;
  domain: string;
  status: string;
  score: number | null;
  contactEmail: string | null;
  emails?: { status: string; followUpIndex: number }[];
}

interface CampaignDetail {
  campaign: {
    id: string;
    name: string;
    industry: string;
    location: string | null;
    targetCount: number;
    mode: string;
    status: string;
    error: string | null;
    createdAt: string;
  };
  prospects: ProspectRow[];
}

const QUALIFY_SCORE = qualifyThreshold();

function statusTone(status: string): Tone {
  if (status === "REPLIED" || status === "QUALIFIED") return "positive";
  if (status === "CONTACTED" || status === "ANALYZING" || status === "RUNNING")
    return "info";
  if (status === "BOUNCED" || status === "FAILED" || status === "CANCELLED")
    return "critical";
  if (status === "DISQUALIFIED" || status === "CLOSED") return "neutral";
  return "warning";
}

function statusLabel(status: string): string {
  if (status === "DISQUALIFIED") return "Site already healthy";
  if (status === "QUALIFIED") return "Needs GEO help";
  if (status === "FOUND") return "Found";
  if (status === "ANALYZING") return "Analyzing site";
  if (status === "CONTACTED") return "Contacted";
  if (status === "CLOSED") return "Closed";
  return status;
}

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const accessRes = await fetch("/api/leads/access", { cache: "no-store" });
    if (accessRes.status === 401) {
      window.location.href = `/login?next=/leads/${params.campaignId}`;
      return;
    }
    const access = await accessRes.json().catch(() => ({}));
    if (!access.allowed) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    const res = await fetch(`/api/leads/campaigns/${params.campaignId}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not load campaign.");
      return;
    }
    setData(json);
  }, [params.campaignId]);

  const campaignStatus = data?.campaign.status ?? null;
  const findingCompanies = Boolean(
    data &&
      data.prospects.length === 0 &&
      !["COMPLETE", "FAILED", "CANCELLED"].includes(data.campaign.status)
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (campaignStatus !== "RUNNING" && !findingCompanies) return;
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, [campaignStatus, findingCompanies, load]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === "ALL") return data.prospects;
    return data.prospects.filter((p) => p.status === filter);
  }, [data, filter]);

  const draftIds = useMemo(
    () =>
      rows
        .filter(
          (p) =>
            p.status === "QUALIFIED" &&
            p.emails?.some(
              (e) =>
                e.followUpIndex === 0 &&
                (e.status === "DRAFT" || e.status === "QUEUED")
            )
        )
        .map((p) => p.id),
    [rows]
  );

  async function patchCampaign(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/campaigns/${params.campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkSend() {
    const ids = selected.size > 0 ? [...selected] : draftIds;
    if (ids.length === 0) return;
    if (!confirm(`Send outreach for ${ids.length} prospect${ids.length === 1 ? "" : "s"}?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/campaigns/${params.campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Send failed.");
      setSelected(new Set());
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <LeadShell
      title={data?.campaign.name ?? "Campaign"}
      subtitle={
        data
          ? `${data.campaign.industry}${data.campaign.location ? ` · ${data.campaign.location}` : ""} · ${data.campaign.mode === "AUTO_SEND" ? "Auto-send" : "Approve first"}`
          : "Prospects found, scored, and queued for outreach."
      }
      actions={
        data ? (
          <div className="flex flex-wrap gap-2">
            {data.campaign.status === "RUNNING" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void patchCampaign("pause")}
              >
                Pause
              </Button>
            )}
            {data.campaign.status === "PAUSED" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void patchCampaign("resume")}
              >
                Resume
              </Button>
            )}
            {(data.campaign.status === "RUNNING" ||
              data.campaign.status === "PAUSED") && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (confirm("Cancel this campaign?")) void patchCampaign("cancel");
                }}
              >
                Cancel
              </Button>
            )}
            <Button variant="secondary" onClick={() => router.push("/leads")}>
              All campaigns
            </Button>
          </div>
        ) : undefined
      }
    >
      {allowed === null && <Skeleton className="h-64" />}
      {allowed === false && <LeadUpgradeGate />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {allowed && data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(data.campaign.status)}>
              {data.campaign.status}
            </Badge>
            <span className="text-sm text-slate-500">
              {data.prospects.length} / {data.campaign.targetCount} prospects ·{" "}
              {formatDate(data.campaign.createdAt)}
            </span>
          </div>
          {data.campaign.error && (
            <p className="rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {data.campaign.error}
            </p>
          )}
          {data.prospects.length > 0 &&
            data.prospects.every((p) => p.status === "DISQUALIFIED") && (
              <p className="rounded-none border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Apollo found these companies (search is free). We crawled each
                site and none scored {QUALIFY_SCORE}+ on outreach need — their
                GEO/SEO already looks healthy enough that we skip the paid
                Apollo email reveal. Higher score = worse site = better lead.
                Click a company to see why.
              </p>
            )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              className="rounded-none border border-slate-200 bg-white px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {[
                "FOUND",
                "ANALYZING",
                "QUALIFIED",
                "DISQUALIFIED",
                "CONTACTED",
                "REPLIED",
                "BOUNCED",
                "CLOSED",
                "FAILED",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button
              disabled={busy || (selected.size === 0 && draftIds.length === 0)}
              onClick={() => void bulkSend()}
            >
              {selected.size > 0
                ? `Send selected (${selected.size})`
                : `Approve & send drafts (${draftIds.length})`}
            </Button>
          </div>

          {rows.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-500">
              {data.prospects.length === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-500" />
                  <p className="font-medium text-slate-700">
                    Still finding companies…
                  </p>
                  <p>
                    You can leave this page — the server keeps looking and
                    results will be here when you come back.
                  </p>
                </div>
              ) : (
                "No prospects match this filter."
              )}
            </Card>
          ) : (
            <div className="overflow-hidden rounded-none border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-3 py-3 font-medium">Company</th>
                    <th className="px-3 py-3 font-medium">
                      Outreach need
                    </th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                          disabled={p.status !== "QUALIFIED"}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/leads/prospects/${p.id}`}
                          className="font-medium text-slate-900 hover:text-violet-700"
                        >
                          {p.companyName}
                        </Link>
                        <p className="text-xs text-slate-400">{p.domain}</p>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">
                        {p.score == null ? "—" : `${p.score}/${QUALIFY_SCORE}`}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={statusTone(p.status)}>
                          {statusLabel(p.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {p.contactEmail ??
                          (p.status === "DISQUALIFIED"
                            ? "Skipped (no credit used)"
                            : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </LeadShell>
  );
}
