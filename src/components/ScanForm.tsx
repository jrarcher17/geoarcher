"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import {
  requestScan,
  setPendingAnalyzeUrl,
} from "@/lib/pending-analyze";
import { cn, hostOf } from "@/lib/utils";

export function ScanForm({
  submitLabel = "Analyze my site",
  layout = "inline",
  onSuccess,
  /** When true, logged-out users go to login with URL saved for after auth. */
  requireAuth = false,
}: {
  submitLabel?: string;
  layout?: "inline" | "stacked";
  onSuccess?: () => void;
  requireAuth?: boolean;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || submitting || sessionPending) return;

    if (requireAuth && !session) {
      setPendingAnalyzeUrl(url.trim());
      router.push("/signup");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await requestScan(url);
      if (!result.ok) {
        if (result.status === 401) {
          setPendingAnalyzeUrl(url.trim());
          router.push("/login");
          return;
        }
        throw new Error(result.error);
      }
      onSuccess?.();
      router.push(`/scan/${result.scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const stacked = layout === "stacked";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={cn(
          "flex gap-3",
          stacked ? "flex-col" : "flex-col sm:flex-row"
        )}
      >
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://mybusiness.com"
          className="input-field flex-1 text-base"
          aria-label="Website URL"
          autoFocus={stacked}
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || sessionPending}
          className={cn(
            "btn-primary shrink-0 px-8 py-3",
            stacked && "w-full sm:w-auto"
          )}
        >
          {submitting
            ? "Starting…"
            : sessionPending
              ? "Loading…"
              : submitLabel}
        </button>
      </div>
      {requireAuth && !session && !sessionPending && (
        <p className="mt-2 text-xs text-slate-500">
          Sign in or create an account to run your crawl — we&apos;ll remember
          this URL.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function pendingAnalyzeHint(url: string | null): string | null {
  if (!url) return null;
  try {
    return hostOf(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return url;
  }
}
