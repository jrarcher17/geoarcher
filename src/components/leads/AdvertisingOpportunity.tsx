"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AdOpportunitySignal } from "@/lib/leads/ad-opportunity";

export interface AdvertisingView {
  opportunity: {
    score: number;
    source: "site_check" | "intelligence";
    signals: AdOpportunitySignal[];
  };
  site: {
    id: string;
    url: string;
    scanStatus: string | null;
    intelligenceStatus: string | null;
  } | null;
  offerings: { id: string; name: string; kind: string }[];
  opportunities: {
    id: string;
    title: string;
    level: string;
    offeringId: string | null;
    offeringName: string | null;
    channels: unknown;
  }[];
  campaigns: {
    id: string;
    name: string;
    platform: string;
    status: string;
  }[];
}

function scanBusy(status: string | null): boolean {
  return ["QUEUED", "CRAWLING", "ANALYZING"].includes(status ?? "");
}

export function AdvertisingOpportunityCard({
  advertising,
  prospectId,
  busy,
  onScan,
}: {
  advertising: AdvertisingView;
  prospectId: string;
  busy: boolean;
  onScan: () => void;
}) {
  const { opportunity, site, offerings, opportunities, campaigns } = advertising;
  const waitingOnScan = Boolean(site && scanBusy(site.scanStatus));
  const waitingOnIntel = Boolean(
    site &&
      !waitingOnScan &&
      (site.intelligenceStatus === "RUNNING" ||
        (site.scanStatus === "COMPLETE" && offerings.length === 0 && !site.intelligenceStatus))
  );
  const ready = Boolean(site && offerings.length > 0);
  const adStudioBase = site
    ? `/ad-studio?site=${site.id}&prospect=${prospectId}`
    : null;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Advertising opportunity
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
            {opportunity.score}
            <span className="text-base font-medium text-slate-400"> / 100</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {opportunity.source === "intelligence"
              ? "From the full site scan and products we identified."
              : "From the site check. Scan the website to identify products and campaigns."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!site && (
            <Button disabled={busy} onClick={onScan}>
              Scan website
            </Button>
          )}
          {site && !ready && (
            <Button disabled={busy || waitingOnScan || waitingOnIntel} onClick={onScan}>
              {waitingOnScan || waitingOnIntel ? "Working…" : "Refresh scan"}
            </Button>
          )}
          {adStudioBase && ready && (
            <Link href={adStudioBase}>
              <Button>Create campaign</Button>
            </Link>
          )}
        </div>
      </div>

      {(waitingOnScan || waitingOnIntel) && (
        <p className="mt-4 rounded-none border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          {waitingOnScan
            ? "Scanning the website. Products and recommended campaigns will appear here when the scan finishes."
            : "Identifying products and services from the scan…"}
        </p>
      )}

      {opportunity.signals.length > 0 && (
        <ul className="mt-5 space-y-1.5">
          {opportunity.signals.map((s) => (
            <li
              key={s.id}
              className={
                s.positive
                  ? "text-sm text-slate-700"
                  : "text-sm text-slate-400"
              }
            >
              <span className="mr-2 text-slate-300" aria-hidden>
                {s.positive ? "▸" : "·"}
              </span>
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {offerings.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recommended campaigns
          </p>
          <ul className="mt-2 divide-y divide-slate-100">
            {(opportunities.length > 0 ? opportunities : offerings.map((o) => ({
              id: o.id,
              title: o.name,
              level: "MEDIUM",
              offeringId: o.id,
              offeringName: o.name,
              channels: [],
            }))).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="font-medium text-slate-800">{row.title}</p>
                  <p className="text-xs text-slate-400">
                    {row.offeringName && row.offeringName !== row.title
                      ? row.offeringName
                      : ""}
                    {row.level ? ` · ${row.level}` : ""}
                  </p>
                </div>
                {adStudioBase && row.offeringId && (
                  <Link
                    href={`${adStudioBase}&offering=${row.offeringId}`}
                    className="text-sm font-medium text-violet-700 hover:underline"
                  >
                    Create campaign
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Campaigns from this prospect
          </p>
          <ul className="mt-2 space-y-1">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="text-sm font-medium text-slate-800 hover:text-violet-700"
                >
                  {c.name}
                </Link>
                <Badge className="ml-2" tone="neutral">
                  {c.platform}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
