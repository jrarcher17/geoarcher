import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Megaphone,
  ScanSearch,
  Target,
  Users,
} from "lucide-react";
import { BrandWordmark } from "@/components/BrandWordmark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <BrandWordmark />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
            GEO Archer turns a website into advertising: scan the business,
            generate campaigns, and publish to Google and Meta when you
            approve.
          </p>
        </div>
        {[
          {
            title: "Product",
            links: [
              { href: "/#product", label: "Product" },
              { href: "/#how", label: "How it works" },
              { href: "/#pricing", label: "Pricing" },
              { href: "/dashboard", label: "Command Center" },
            ],
          },
          {
            title: "Company",
            links: [
              { href: "/login", label: "Sign in" },
              { href: "/strategy", label: "Request a strategy" },
              { href: "/terms", label: "Terms of Service" },
              { href: "/privacy", label: "Privacy Policy" },
            ],
          },
        ].map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-slate-900">{col.title}</p>
            <ul className="mt-4 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-500 transition hover:text-violet-700"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} GEO Archer. All rights reserved.
      </div>
    </footer>
  );
}

export function FinalCta({
  signUpDisabled = false,
}: {
  signUpDisabled?: boolean;
}) {
  const href = signUpDisabled ? "/login" : "/signup";
  const label = signUpDisabled ? "Sign in" : "Start free";

  return (
    <section className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-900 px-8 py-16 text-center sm:px-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
          Get more customers from AI &amp; advertising
        </p>
        <h2 className="mt-3 text-2xl font-bold text-white sm:text-4xl">
          Want GEO Archer to build your advertising strategy?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Request a strategy from your company and website, or start free and
          generate the ads yourself. Nothing publishes until you say so.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/strategy"
            className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400"
          >
            Request a strategy
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={href}
            className="inline-flex items-center rounded-full border border-white/20 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {label}
          </Link>
        </div>
      </div>
    </section>
  );
}

export const FEATURE_CARDS = [
  {
    icon: ScanSearch,
    title: "Site Intelligence",
    body: "A scan reads the website and extracts the business, products, services, images, and advertising opportunities — only claims found on the site.",
    bullets: [
      "Products and services identified",
      "Usable images for creative",
      "Recommended campaigns",
    ],
  },
  {
    icon: Megaphone,
    title: "Ad Studio",
    body: "Pick what to advertise. AI writes Google and Meta ads from the scan. You edit, pick a creative, and save a draft or mark it Ready.",
    bullets: [
      "Grounded headlines and copy",
      "Landing page from the site",
      "Nothing publishes on generate",
    ],
  },
  {
    icon: Target,
    title: "Campaigns & analytics",
    body: "One list across Google and Meta. Spend, clicks, and conversions appear only after a campaign runs on a connected account — never estimated.",
    bullets: [
      "Draft, Ready, Active",
      "Real CampaignMetric data",
      "Connect when you're ready",
    ],
  },
] as const;

export const CONTROL_CARDS = [
  {
    icon: Bot,
    title: "AI Assistant",
    body: "Ask how campaigns are doing. Propose a change. Anything that spends money waits in an approval trail until you Approve or Reject.",
  },
  {
    icon: Users,
    title: "Lead Generation",
    body: "Find businesses that need better advertising, score the opportunity, scan their site, and open Ad Studio — Pro Plus.",
  },
] as const;

export function HeroDashboardMock() {
  return (
    <div className="bg-[#0b1220] p-4 text-left sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
            Command Center
          </p>
          <p className="text-sm font-semibold text-white">yoursite.com</p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
          Scan complete
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Products & services", value: "6" },
          { label: "Ad opportunities", value: "4" },
          { label: "Draft campaigns", value: "2" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <p className="text-[11px] text-slate-400">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold text-slate-300">
            Worth advertising
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>Emergency Plumbing</li>
            <li>Water Heater Repair</li>
            <li>Drain Cleaning</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold text-slate-300">Ad spend</p>
          <p className="mt-2 text-2xl font-bold text-white">—</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Metrics stay empty until you connect Google or Meta and a campaign
            actually runs. This preview is the workspace — not demo performance.
          </p>
        </div>
      </div>
    </div>
  );
}
