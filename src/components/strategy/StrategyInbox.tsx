"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/advertising/format";

interface Row {
  id: string;
  name: string;
  email: string;
  company: string;
  website: string;
  monthlyAdBudgetCents: number | null;
  createdAt: string;
}

export function StrategyInbox() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [inbox, setInbox] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/strategy", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load requests.");
        return json;
      })
      .then((json) => {
        if (!cancelled) {
          setRows(json.requests);
          setInbox(Boolean(json.inbox));
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not load requests.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="text-sm text-slate-400">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No strategy requests yet.{" "}
        <a href="/strategy" className="underline underline-offset-2">
          Request a strategy
        </a>
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">
        {inbox
          ? "Inbox — every stored request (STRATEGY_INBOX_EMAIL)."
          : "Requests submitted with your account or email."}
      </p>
      <div className="overflow-x-auto border border-slate-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Website</th>
              <th className="px-3 py-2">Budget</th>
              <th className="px-3 py-2">Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2.5 font-medium text-slate-900">{r.company}</td>
                <td className="px-3 py-2.5 text-slate-600">
                  {r.name}
                  <span className="block text-xs text-slate-400">{r.email}</span>
                </td>
                <td className="px-3 py-2.5">
                  <a
                    href={r.website}
                    className="text-slate-700 underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.website.replace(/^https?:\/\//, "")}
                  </a>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-slate-600">
                  {r.monthlyAdBudgetCents
                    ? `${formatMoney(r.monthlyAdBudgetCents)}/mo`
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
