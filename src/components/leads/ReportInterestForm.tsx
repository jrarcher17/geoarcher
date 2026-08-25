"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ReportInterestForm({
  token,
  alreadyRequested,
}: {
  token: string;
  alreadyRequested: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p className="mt-4 text-sm font-medium text-violet-800">
        Thanks — we&apos;ll be in touch shortly about a Pro Plus plan.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/reports/${token}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setError(json?.error ?? "Could not send that. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not send that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto mt-5 max-w-md text-left">
      <p className="text-sm text-slate-600">
        Leave your email and we&apos;ll reach out about a Pro Plus plan to fix
        these issues and track them over time.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          className="input-field"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <input
          className="input-field"
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 text-center">
        <Button type="submit" disabled={busy || !email.includes("@")}>
          {busy ? "Sending…" : "Contact me about Pro Plus"}
        </Button>
      </div>
    </form>
  );
}
