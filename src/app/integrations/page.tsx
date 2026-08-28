"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FadeIn } from "@/components/cards/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AccountOption {
  id: string;
  name: string;
}

interface PlatformStatus {
  connected: boolean;
  accountId: string | null;
  accountName: string | null;
  accounts: AccountOption[];
  needsAccount: boolean;
  error: string | null;
  available: boolean;
}

interface IntegrationsStatus {
  google: PlatformStatus;
  meta: PlatformStatus;
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
  platform,
  description,
  status,
  connectLabel,
  unavailableNote,
  onChanged,
}: {
  name: string;
  platform: "google" | "meta";
  description: string;
  status: PlatformStatus;
  connectLabel: string;
  unavailableNote: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${platform}/disconnect`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Disconnect failed.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setBusy(false);
    }
  }

  async function selectAccount(accountId: string, accountName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${platform}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, accountName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not select the account.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{name}</h2>
        <StatusPill connected={status.connected} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
      {status.connected && status.accountName && (
        <p className="mt-3 text-sm text-slate-700">
          Account: <span className="font-medium">{status.accountName}</span>
        </p>
      )}
      {(error || status.error) && (
        <p className="mt-3 text-sm text-red-600">{error ?? status.error}</p>
      )}

      {status.connected && status.accounts.length > 1 && (
        <div className="mt-4">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Ad account
          </label>
          <select
            className="w-full border border-slate-300 bg-white px-3 py-2 text-sm"
            disabled={busy}
            value={status.accountId ?? ""}
            onChange={(e) => {
              const opt = status.accounts.find((a) => a.id === e.target.value);
              if (opt) void selectAccount(opt.id, opt.name);
            }}
          >
            <option value="" disabled>
              Select an account
            </option>
            {status.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!status.connected && status.available && (
          <a href={`/api/integrations/${platform}/start`} className="btn-primary text-sm">
            {connectLabel}
          </a>
        )}
        {!status.connected && !status.available && (
          <div>
            <button
              type="button"
              disabled
              className="btn-secondary cursor-not-allowed text-sm opacity-60"
            >
              {connectLabel}
            </button>
            <p className="mt-2 text-xs text-slate-400">{unavailableNote}</p>
          </div>
        )}
        {status.connected && (
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-60"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            {busy ? "Working…" : "Disconnect"}
          </button>
        )}
      </div>
    </article>
  );
}

function IntegrationsInner() {
  const params = useSearchParams();
  const [data, setData] = useState<IntegrationsStatus | null>(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(
    params.get("connected")
      ? `Connected ${params.get("connected") === "google" ? "Google Ads" : "Meta"}. Tokens are stored encrypted on the server.`
      : null
  );
  const [syncing, setSyncing] = useState(false);

  function load() {
    fetch("/api/integrations", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load.");
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load.")
      );
  }

  useEffect(() => {
    load();
  }, []);

  async function syncMetrics() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed.");
      setNotice(
        json.upserts > 0
          ? `Synced ${json.upserts} daily metric row${json.upserts === 1 ? "" : "s"} from connected accounts.`
          : "Sync finished. No published campaigns had new metrics."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const anyConnected = data?.google.connected || data?.meta.connected;

  return (
    <AppShell
      title="Integrations"
      subtitle="Connect your advertising accounts. Credentials are stored server-side and never exposed to the browser."
    >
      {error && (
        <p className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {notice}
        </p>
      )}
      {!data && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}

      {data && (
        <FadeIn className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <IntegrationCard
              name="Google Ads"
              platform="google"
              description="Publish search campaigns, sync spend and conversion data, and let AI optimize budgets and keywords."
              status={data.google}
              connectLabel="Connect Google Ads"
              unavailableNote="Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET and GOOGLE_ADS_DEVELOPER_TOKEN, then restart the server. Redirect URI: /api/integrations/google/callback"
              onChanged={load}
            />
            <IntegrationCard
              name="Meta Ads"
              platform="meta"
              description="Publish Facebook and Instagram campaigns with creative from your website, and pull performance data."
              status={data.meta}
              connectLabel="Connect Meta"
              unavailableNote="Set META_ADS_APP_ID and META_ADS_APP_SECRET, then restart the server. Redirect URI: /api/integrations/meta/callback"
              onChanged={load}
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
          </div>

          {anyConnected && (
            <div className="border border-slate-200 bg-white px-6 py-4">
              <p className="text-sm text-slate-600">
                Pull spend and conversions from published campaigns into Analytics.
                Only numbers the ad platform actually reports are stored.
              </p>
              <button
                type="button"
                className="btn-secondary mt-3 text-sm disabled:opacity-60"
                disabled={syncing}
                onClick={() => void syncMetrics()}
              >
                {syncing ? "Syncing…" : "Sync performance now"}
              </button>
            </div>
          )}
        </FadeIn>
      )}
    </AppShell>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsInner />
    </Suspense>
  );
}
