"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  Globe,
  LayoutDashboard,
  Megaphone,
  Menu,
  Plug,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import { BrandWordmark } from "@/components/BrandWordmark";
import { cn } from "@/lib/utils";
import { isProtectedAppPath, loginUrlWithReturn } from "@/lib/auth-guard";

const NAV = [
  {
    label: "Command Center",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/sites", label: "Sites", icon: Globe },
      { href: "/ad-studio", label: "Ad Studio", icon: Megaphone },
      { href: "/campaigns", label: "Campaigns", icon: Target },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/leads", label: "Lead Generation", icon: Users },
      { href: "/assistant", label: "AI Assistant", icon: Bot },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/dashboard") return pathname === "/dashboard";
  if (path === "/settings") return pathname === "/settings";
  return pathname === path || pathname.startsWith(`${path}/`);
}

interface LiveStatus {
  active: boolean;
  scanning: boolean;
  sites: number;
  offerings: number;
  opportunities: number;
  campaigns: number;
  activeCampaigns: number;
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
  breadcrumb?: string;
  actions?: React.ReactNode;
  live?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<LiveStatus | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || sessionPending) return;
    if (!session && isProtectedAppPath(pathname)) {
      router.replace(loginUrlWithReturn(pathname));
    }
  }, [mounted, sessionPending, session, pathname, router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/me/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setStatus(json);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
    router.refresh();
  }

  const authReady = mounted && !sessionPending;

  const initials =
    session?.user?.name
      ?.split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    session?.user?.email?.slice(0, 2).toUpperCase() ||
    "GA";

  const sidebarAccount = !authReady ? (
    <div className="flex items-center gap-3" aria-busy="true" aria-label="Loading account">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/10" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-2.5 w-16 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  ) : session ? (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-slate-200">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {session.user.name || "Account"}
        </p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
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
  );

  const sidebar = (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-[#0b1220] text-slate-300">
      <div className="px-5 py-5">
        <Link href="/dashboard">
          <BrandWordmark variant="dark" />
        </Link>
      </div>

      <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const IconEl = item.icon;
                return (
                  <li key={`${group.label}-${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition",
                        active
                          ? "bg-white/10 font-medium text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      )}
                    >
                      <IconEl
                        className={cn(
                          "h-3.5 w-3.5",
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

      {status && (
        <div className="mx-3 mb-3 border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-200">GEO Archer</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                status.active ? "text-emerald-400" : "text-slate-500"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status.active ? "bg-emerald-400" : "bg-slate-500"
                )}
              />
              {status.scanning ? "Scanning" : status.active ? "Active" : "Idle"}
            </span>
          </div>
          <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
            <li>{status.sites} sites scanned</li>
            <li>{status.offerings} products &amp; services</li>
            <li>{status.opportunities} ad opportunities</li>
            <li>
              {status.activeCampaigns} active / {status.campaigns} campaigns
            </li>
          </ul>
        </div>
      )}

      <div className="border-t border-white/10 p-4">{sidebarAccount}</div>
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
                className="border border-slate-200 bg-white p-2 text-slate-600 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden min-w-0 items-center gap-2 text-sm text-slate-500 sm:flex">
                <span className="truncate font-medium text-slate-700">{title}</span>
                {breadcrumb && breadcrumb !== title && (
                  <>
                    <span className="text-slate-300">/</span>
                    <span className="shrink-0 text-slate-500">{breadcrumb}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="w-full">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
                  {title}
                  {live && (
                    <span className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      Live
                    </span>
                  )}
                </h1>
                {subtitle && (
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
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
