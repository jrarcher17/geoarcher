"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  Eye,
  FileBarChart,
  Globe,
  LayoutDashboard,
  Lightbulb,
  Menu,
  MessageCircleQuestion,
  Radar,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import { BrandWordmark } from "@/components/BrandWordmark";
import { cn } from "@/lib/utils";

const NAV = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/sites", label: "Sites", icon: Globe },
      { href: "/scans", label: "Scans", icon: Radar },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/visibility", label: "AI Visibility", icon: Eye },
      { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
      {
        href: "/opportunities",
        label: "Content Opportunities",
        icon: MessageCircleQuestion,
      },
      { href: "/competitors", label: "Competitors", icon: Users },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/reports", label: "Reports", icon: FileBarChart },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/sites") return pathname === "/sites" || pathname.startsWith("/sites/");
  if (href === "/scans") return pathname === "/scans" || pathname.startsWith("/scan/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  title,
  subtitle,
  breadcrumb,
  actions,
  live = false,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Optional trail segment shown after the workspace chip. */
  breadcrumb?: string;
  /** Right-aligned header actions (buttons etc.). */
  actions?: React.ReactNode;
  live?: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials =
    session?.user?.name
      ?.split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    session?.user?.email?.slice(0, 2).toUpperCase() ||
    "GA";

  const sidebar = (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-[#0b1220] text-slate-300">
      <div className="px-5 py-5">
        <Link href="/dashboard">
          <BrandWordmark variant="dark" />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const IconEl = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                        active
                          ? "bg-sky-500/90 font-medium text-white shadow-sm shadow-sky-900/40"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      )}
                    >
                      <IconEl
                        className={cn(
                          "h-4 w-4",
                          active ? "text-white" : "text-slate-500"
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        {session ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-300">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {session.user.name || "Account"}
              </p>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <Link href="/login" className="text-sm text-sky-400 hover:text-sky-300">
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#f4f6fb]">
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full shadow-2xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f4f6fb]/90 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden min-w-0 items-center gap-2 text-sm text-slate-500 sm:flex">
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">
                  Personal
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <span className="text-slate-300">/</span>
                {breadcrumb && (
                  <>
                    <span className="shrink-0 text-slate-500">{breadcrumb}</span>
                    <span className="text-slate-300">/</span>
                  </>
                )}
                <span className="truncate font-medium text-slate-700">{title}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 md:flex">
                <Search className="h-4 w-4" />
                <span>Search</span>
                <kbd className="ml-6 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  ⌘K
                </kbd>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="w-full">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {title}
                  {live && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      Live
                    </span>
                  )}
                </h1>
                {subtitle && (
                  <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              )}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
