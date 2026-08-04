"use client";

import { useEffect, useState } from "react";
import type { GeoJsonLdBlock } from "@/lib/geo-fix";

interface GeoApiResponse {
  siteKey: string;
  siteUrl: string;
  proposal: { blocks: GeoJsonLdBlock[]; meta: Record<string, string> };
  published: {
    enabled: boolean;
    updatedAt: string;
    blockCount: number;
    sourceScanId: string | null;
  } | null;
  telemetry: { hitsLast7Days: number };
}

export function AutoFixPanel({ scanId }: { scanId: string }) {
  const [data, setData] = useState<GeoApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/geo`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to load auto-fix settings.");
      }
      const json: GeoApiResponse = await res.json();
      setData(json);
      setSelected(new Set(json.proposal.blocks.map((b) => b.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/scans/${scanId}/geo`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Failed to load auto-fix settings.");
        }
        const json: GeoApiResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setSelected(new Set(json.proposal.blocks.map((b) => b.id)));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-app.com";
  const snippet = data
    ? `<script src="${origin}/geo.js"\n        data-site="${data.siteKey}"\n        async></script>`
    : "";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function publish(enabled: boolean) {
    if (!data) return;
    setPublishing(true);
    setError(null);
    try {
      const blocks = data.proposal.blocks.filter((b) => selected.has(b.id));
      const res = await fetch(`/api/scans/${scanId}/geo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          blocks,
          meta: data.proposal.meta,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Publish failed.");
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  async function draftGapFaqs() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/geo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft-gap-faqs" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Draft failed.");
      }
      const json = await res.json();
      setData((d) => (d ? { ...d, proposal: json.proposal } : d));
      setSelected(new Set(json.proposal.blocks.map((b: GeoJsonLdBlock) => b.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed.");
    } finally {
      setDrafting(false);
    }
  }

  if (loading) {
    return (
      <section className="card p-6 text-slate-500">
        Loading auto-fix…
      </section>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Auto-fix (geo.js)</h2>
      <p className="mt-1 text-sm text-slate-500">
        Approve structured data and lightweight AI-readable metadata — injected via
        JSON-LD only, not hidden marketing copy. Edit visible content in your CMS;
        use this for schema, telemetry, and approved enhancements.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {data.published?.enabled && (
        <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Live — {data.published.blockCount} JSON-LD block
          {data.published.blockCount === 1 ? "" : "s"} · updated{" "}
          {new Date(data.published.updatedAt).toLocaleString()} ·{" "}
          {data.telemetry.hitsLast7Days} page load
          {data.telemetry.hitsLast7Days === 1 ? "" : "s"} (7d)
        </p>
      )}

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-700">Install snippet</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          {snippet}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          On production, host <code className="text-slate-500">geo.js</code> from
          your GeoArcher domain. Optional{" "}
          <code className="text-slate-500">data-api=&quot;https://…&quot;</code> if
          the script is served elsewhere.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => publish(true)}
          disabled={publishing || selected.size === 0}
          className="btn-primary shrink-0"
        >
          {publishing ? "Publishing…" : "Approve & publish"}
        </button>
        {data.published?.enabled && (
          <button
            type="button"
            onClick={() => publish(false)}
            disabled={publishing}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm text-slate-700 hover:border-slate-300 disabled:opacity-50"
          >
            Disable on site
          </button>
        )}
        <button
          type="button"
          onClick={draftGapFaqs}
          disabled={drafting}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:border-slate-300 disabled:opacity-50"
        >
          {drafting ? "Drafting…" : "Draft gap FAQs (AI)"}
        </button>
      </div>

      <ul className="mt-6 flex flex-col gap-2">
        {data.proposal.blocks.map((block) => (
          <li
            key={block.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(block.id)}
                onChange={() => toggle(block.id)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{block.label}</p>
                <p className="text-sm text-slate-500">{block.description}</p>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === block.id ? null : block.id)
                  }
                  className="mt-2 text-xs text-sky-500 hover:underline"
                >
                  {expanded === block.id ? "Hide JSON-LD" : "Preview JSON-LD"}
                </button>
                {expanded === block.id && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">
                    {JSON.stringify(block.schema, null, 2)}
                  </pre>
                )}
              </div>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
