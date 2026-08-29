"use client";

import { useState } from "react";

export function StrategyForm({
  defaults,
}: {
  defaults?: {
    name?: string;
    email?: string;
    company?: string;
    website?: string;
  };
}) {
  const [name, setName] = useState(defaults?.name ?? "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [company, setCompany] = useState(defaults?.company ?? "");
  const [website, setWebsite] = useState(defaults?.website ?? "");
  const [budget, setBudget] = useState("");
  const [websiteExtra, setWebsiteExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          website,
          monthlyAdBudget: budget.trim() || null,
          websiteExtra,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.received) {
        setDone(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Could not send the request.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="border border-slate-200 bg-white px-6 py-8">
        <p className="text-lg font-semibold text-slate-900">Request received</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Thanks. We stored your details and will follow up about an advertising
          and GEO strategy. Nothing was published and no ad account was connected.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border border-slate-200 bg-white p-6">
      <label className="text-sm">
        <span className="font-medium text-slate-700">Name</span>
        <input
          className="input-field mt-1.5"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
        />
      </label>
      <label className="text-sm">
        <span className="font-medium text-slate-700">Email</span>
        <input
          type="email"
          className="input-field mt-1.5"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </label>
      <label className="text-sm">
        <span className="font-medium text-slate-700">Company</span>
        <input
          className="input-field mt-1.5"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
          minLength={2}
          maxLength={120}
          autoComplete="organization"
        />
      </label>
      <label className="text-sm">
        <span className="font-medium text-slate-700">Website</span>
        <input
          className="input-field mt-1.5"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          required
          placeholder="https://example.com"
          autoComplete="url"
        />
      </label>
      <input
        className="absolute left-[-9999px] h-px w-px opacity-0"
        aria-hidden
        tabIndex={-1}
        autoComplete="off"
        value={websiteExtra}
        onChange={(e) => setWebsiteExtra(e.target.value)}
      />
      <label className="text-sm">
        <span className="font-medium text-slate-700">
          Monthly ad budget <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <input
          className="input-field mt-1.5"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 2500"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary text-sm disabled:opacity-60" disabled={busy}>
        {busy ? "Sending…" : "Request a strategy"}
      </button>
    </form>
  );
}
