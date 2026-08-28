"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface IntegrationsStatus {
  google: {
    connected: boolean;
    accountName: string | null;
    error: string | null;
    available: boolean;
  };
  meta: {
    connected: boolean;
    accountName: string | null;
    error: string | null;
    available: boolean;
  };
  openai: { configured: boolean; model: string };
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold",
        connected ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          connected ? "bg-emerald-500" : "bg-slate-400"
        )}
      />
      {connected ? "Connected" : "Not Connected"}
    </span>
  );
}

function IntegrationCard({
  name,
  description,
  connected,
  accountName,
  available,
  connectLabel,
  unavailableNote,
}: {
  name: string;
  description: string;
  connected: boolean;
  accountName: string | null;
  available: boolean;
  connectLabel: string;
  unavailableNote: string;
}) {
  return (
    <article className="border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{name}</h2>
        <StatusPill connected={connected} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
      {connected && accountName && (
        <p className="mt-3 text-sm text-slate-700">
          Account: <span className="font-medium">{accountName}</span>
        </p>
      )}
      {!connected && (
        <div className="mt-5">
          <button
            type="button"
            disabled
            className="btn-secondary cursor-not-allowed text-sm opacity-60"
          >
            {connectLabel}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            {available
              ? "OAuth credentials detected. The connection flow ships with the ad-platform integration stage."
              : unavailableNote}
          </p>
        </div>
      )}
    </article>
  );
}

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load.");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      title="Integrations"
      subtitle="Connect your advertising accounts. Credentials are stored server-side and never exposed to the browser."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}

      {data && (
        <FadeIn className="grid gap-4 lg:grid-cols-2">
          <IntegrationCard
            name="Google Ads"
            description="Publish search campaigns, sync spend and conversion data, and let AI optimize budgets and keywords."
            connected={data.google.connected}
            accountName={data.google.accountName}
            available={data.google.available}
            connectLabel="Connect Google Ads"
            unavailableNote="OAuth isn't configured on this server yet. Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET to enable the connection flow."
          />
          <IntegrationCard
            name="Meta Ads"
            description="Publish Facebook and Instagram campaigns with creative from your website, and pull performance data."
            connected={data.meta.connected}
            accountName={data.meta.accountName}
            available={data.meta.available}
            connectLabel="Connect Meta"
            unavailableNote="OAuth isn't configured on this server yet. Set META_ADS_APP_ID and META_ADS_APP_SECRET to enable the connection flow."
          />
          <article className="border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">OpenAI</h2>
              <StatusPill connected={data.openai.configured} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              The intelligence layer: website understanding, ad copy generation,
              audience recommendations and campaign analysis.
            </p>
            {data.openai.configured ? (
              <p className="mt-3 text-sm text-slate-700">
                Model: <span className="font-mono text-xs">{data.openai.model}</span>
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Set OPENAI_API_KEY on the server to enable AI generation and analysis.
              </p>
            )}
          </article>
          <article className="border border-dashed border-slate-300 bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                AI / ChatGPT Advertising
              </h2>
              <span className="inline-flex bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                Coming Soon
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Advertising opportunities inside AI platforms will be supported as
              official advertising APIs become available.
            </p>
          </article>
        </FadeIn>
      )}
    </AppShell>
  );
}
