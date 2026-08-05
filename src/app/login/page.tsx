"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { pendingAnalyzeHint } from "@/components/ScanForm";
import { signIn, signUp } from "@/lib/auth-client";
import {
  getPendingAnalyzeUrl,
  resumePendingAnalyze,
} from "@/lib/pending-analyze";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAnalyze = searchParams.get("from") === "analyze";
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("sign-up") === "1") {
      setMode("sign-up");
    }
  }, [searchParams]);

  useEffect(() => {
    if (fromAnalyze) {
      setPendingUrl(getPendingAnalyzeUrl());
    }
  }, [fromAnalyze]);

  const analyzeHost = pendingAnalyzeHint(pendingUrl);

  async function afterAuth() {
    const resumed = await resumePendingAnalyze();
    if (resumed.kind === "scan") {
      router.push(`/scan/${resumed.scanId}`);
      router.refresh();
      return;
    }
    if (resumed.kind === "error") {
      if (resumed.status === 403) {
        router.push(
          `/settings?tab=billing&scanError=${encodeURIComponent(resumed.error)}`
        );
        router.refresh();
        return;
      }
      setError(resumed.error);
      return;
    }
    const next = searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      router.push(next);
      router.refresh();
      return;
    }
    router.push(fromAnalyze ? "/sites" : "/dashboard");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "sign-up") {
        const res = await signUp.email({ name, email, password });
        if (res.error) throw new Error(res.error.message ?? "Sign up failed.");
      } else {
        const res = await signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message ?? "Sign in failed.");
      }
      await afterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-1">
      <div className="flex w-full flex-col justify-center bg-white px-8 py-12 sm:w-1/2 sm:px-16 lg:px-24">
        <Link href="/">
          <BrandWordmark />
        </Link>
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-slate-900">
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-slate-500">
          {fromAnalyze && analyzeHost ? (
            <>
              Sign in to analyze{" "}
              <span className="font-medium text-slate-800">{analyzeHost}</span>.
              We&apos;ll start the crawl as soon as you&apos;re in — if your plan
              has room for another site or scan.
            </>
          ) : mode === "sign-in" ? (
            "Sign in to your GEO Archer workspace."
          ) : (
            "Start tracking AI visibility for your sites."
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex max-w-md flex-col gap-4">
          {mode === "sign-up" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input-field"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Work email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              className="input-field"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading
              ? fromAnalyze
                ? "Starting scan…"
                : "Please wait…"
              : mode === "sign-in"
                ? fromAnalyze
                  ? "Sign in & analyze"
                  : "Sign in"
                : fromAnalyze
                  ? "Create account & analyze"
                  : "Create account"}
          </button>
        </form>

        {error && <p className="mt-4 max-w-md text-sm text-red-600">{error}</p>}

        <p className="mt-8 max-w-md text-sm text-slate-500">
          {mode === "sign-in" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("sign-up")}
                className="font-medium text-sky-500 hover:text-sky-600"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("sign-in")}
                className="font-medium text-sky-500 hover:text-sky-600"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <Link
          href="/"
          className="mt-6 text-sm text-slate-400 hover:text-slate-600"
        >
          Back to home
        </Link>
      </div>

      <div className="hidden w-1/2 flex-col justify-center bg-gradient-to-b from-slate-900 to-slate-950 px-12 py-16 text-white lg:flex lg:px-16">
        <h2 className="text-3xl font-bold leading-tight">
          Paste a URL.
          <br />
          Know how AI sees you.
        </h2>
        <p className="mt-4 max-w-md text-lg text-slate-300">
          Crawl your site, score GEO and AI understanding, simulate citations,
          and ship structured data — built for ChatGPT, Claude, Gemini, and
          Perplexity.
        </p>
        <ul className="mt-10 space-y-4 text-sm text-slate-300">
          {[
            "Semantic map — concepts, not pages",
            "13-component GEO audit with specific fixes",
            "Competitor compare and weekly recrawl diffs",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sky-500/20 text-sky-300">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-slate-400">
          Loading…
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
