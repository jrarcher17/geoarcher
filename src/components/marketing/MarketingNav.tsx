"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { cn } from "@/lib/utils";

const SIGN_UP_HREF = "/login?sign-up=1";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#platform", label: "Platform" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#guides", label: "Guides" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <BrandWordmark className="text-lg sm:text-xl" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Login
          </Link>
          <Link
            href={SIGN_UP_HREF}
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-600"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-slate-100 bg-white px-4 pb-4 md:hidden",
          open ? "block" : "hidden"
        )}
      >
        <div className="flex flex-col gap-3 pt-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-700"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="text-sm font-medium text-slate-600">
            Login
          </Link>
          <Link
            href={SIGN_UP_HREF}
            className="inline-flex justify-center rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white"
            onClick={() => setOpen(false)}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
