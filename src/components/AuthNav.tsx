"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

export function AuthNav() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  if (pathname === "/login") {
    return null;
  }

  return (
    <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="brand-wordmark">
          Geo<span className="brand-wordmark-accent">Archer</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-slate-600 hover:text-slate-900"
          >
            Dashboard
          </Link>
          {isPending ? (
            <span className="text-slate-400">…</span>
          ) : session ? (
            <>
              <span className="hidden text-slate-500 sm:inline">
                {session.user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-slate-500 hover:text-slate-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sky-500 hover:text-sky-600">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
