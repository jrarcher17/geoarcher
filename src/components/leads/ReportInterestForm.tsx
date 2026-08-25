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
        Thanks — we&apos;ll be in touch shortly.
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
        Leave your email and we&apos;ll show you where your site is falling
        short—and what you can do to get more visibility, traffic, and leads
        from ChatGPT, Google AI, and other AI search engines.
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
        <Button
          type="submit"
          className="h-auto whitespace-normal px-5 py-2.5"
          disabled={busy || !email.includes("@")}
        >
          {busy ? "Sending…" : "Let’s see how visible your business really is."}
        </Button>
      </div>
    </form>
  );
}
