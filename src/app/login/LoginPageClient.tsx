"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { pendingAnalyzeHint } from "@/components/ScanForm";
import { signIn, signUp } from "@/lib/auth-client";
import {
  getPendingAnalyzeUrl,
  resumePendingAnalyze,
} from "@/lib/pending-analyze";

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-[#eef4fb] px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400/25";

function LoginPageInner({
  signUpDisabled: registrationsClosed,
}: {
  signUpDisabled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAnalyze = searchParams.get("from") === "analyze";
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (registrationsClosed) return;
    if (searchParams.get("sign-up") === "1") {
      setMode("sign-up");
    }
  }, [searchParams, registrationsClosed]);

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
        if (registrationsClosed) {
          throw new Error("New registrations are currently closed.");
        }
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

  const title = mode === "sign-in" ? "Welcome back" : "Create your account";
  const subtitle =
    fromAnalyze && analyzeHost ? (
      <>
        Sign in to analyze{" "}
        <span className="font-medium text-slate-800">{analyzeHost}</span>.
        We&apos;ll start the crawl as soon as you&apos;re in.
      </>
    ) : mode === "sign-in" ? (
      "Sign in to manage your sites, scans, and Autopilot."
    ) : (
      "Start tracking how AI assistants see your sites."
    );

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{subtitle}</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        {mode === "sign-up" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-800">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className={fieldClass}
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-800">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={fieldClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-800">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              className={`${fieldClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-sky-500 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-500/25 transition hover:bg-sky-600 disabled:opacity-50"
        >
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

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {registrationsClosed && (
        <p className="mt-4 text-sm text-amber-800">
          New account registration is closed. Sign in if you already have access.
        </p>
      )}

      <p className="mt-8 text-center text-sm text-slate-500">
        {mode === "sign-in" ? (
          registrationsClosed ? (
            <>Need access? Contact your administrator.</>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("sign-up")}
                className="font-semibold text-slate-900 hover:text-sky-600"
              >
                Sign up free
              </button>
            </>
          )
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("sign-in")}
              className="font-semibold text-slate-900 hover:text-sky-600"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </AuthSplitLayout>
  );
}

export function LoginPageClient({
  signUpDisabled: registrationsClosed,
}: {
  signUpDisabled: boolean;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-slate-400">
          Loading…
        </main>
      }
    >
      <LoginPageInner signUpDisabled={registrationsClosed} />
    </Suspense>
  );
}
