"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push(`/scan/${data.scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://mybusiness.com"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
          aria-label="Website URL"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {submitting ? "Starting…" : "Analyze my site"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </form>
  );
}
