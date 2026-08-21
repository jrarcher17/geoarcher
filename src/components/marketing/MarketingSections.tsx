import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  Gauge,
  Globe,
  Radar,
  Sparkles,
  TrendingUp,
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
            GEO Archer helps you see your website the way AI assistants do —
            then fix what they cannot cite.
          </p>
        </div>
        {[
          {
            title: "Product",
            links: [
              { href: "/#features", label: "Features" },
              { href: "/#autopilot", label: "SEO Autopilot" },
              { href: "/#pricing", label: "Pricing" },
              { href: "/#guides", label: "Guides" },
            ],
          },
          {
            title: "Company",
            links: [
              { href: "/login", label: "Sign in" },
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
                    className="text-sm text-slate-500 transition hover:text-sky-600"
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

export function FinalCta({ signUpDisabled = false }: { signUpDisabled?: boolean }) {
  const href = signUpDisabled ? "/login" : "/signup";
  const label = signUpDisabled ? "Sign in" : "Get started for free";

  return (
    <section className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-900 px-8 py-16 text-center sm:px-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Get started with GEO Archer today
        </p>
        <h2 className="mt-3 text-2xl font-bold text-white sm:text-4xl">
          Ready to see how AI understands your site?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Run your first crawl in minutes. Free includes full scoring on one
          site — upgrade when you need Autopilot, depth, and volume.
        </p>
        <Link
          href={href}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-sky-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
        >
          {label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export const FEATURE_CARDS = [
  {
    icon: Globe,
    title: "AI website crawl",
    body: "GEO-powered crawl builds the semantic map assistants infer: topics, entities, and gaps — not just a page list.",
    bullets: ["Up to 200 pages on Pro", "Schema & technical audit", "Page-level health"],
  },
  {
    icon: Radar,
    title: "Visibility & GEO scores",
    body: "Understanding score, 13-component GEO score, and modeled visibility across ChatGPT, Claude, Gemini, Perplexity, and Copilot.",
    bullets: ["Executive dashboard KPIs", "Trend over rescans", "Simulation prompts"],
  },
  {
    icon: Users,
    title: "Competitor benchmarks",
    body: "Compare your scores against up to five rival sites on the same crawl budget — see where assistants would prefer them.",
    bullets: ["Side-by-side scores", "200-page competitor budget", "Gap-driven actions"],
  },
] as const;

export const AUTOPILOT_CARDS = [
  {
    icon: Gauge,
    title: "Continuous loop",
    body: "Turn Autopilot on and the site stays on a durable cycle: recrawl, GEO analysis, SEO audit, competitors, then sleep until the next run.",
  },
  {
    icon: FileSearch,
    title: "Audits that stay current",
    body: "Technical SEO, page scores, content plans, and internal-link suggestions refresh from the latest crawl — not a one-off PDF.",
  },
  {
    icon: TrendingUp,
    title: "Keyword rankings",
    body: "Track real Google positions for the terms you care about. Autopilot re-checks them each cycle so movement shows up without a manual run.",
  },
  {
    icon: Radar,
    title: "Change detection",
    body: "Each cycle diffs the crawl against the last one — new, changed, and removed pages — so you see what actually moved.",
  },
] as const;

const VISIBILITY_ROWS: { name: string; value: number; you?: boolean }[] = [
  { name: "Your site", value: 71, you: true },
  { name: "Competitor A", value: 84 },
  { name: "Competitor B", value: 62 },
  { name: "Competitor C", value: 55 },
];

export function HeroDashboardMock() {
  return (
    <div className="bg-[#0b1220] p-4 text-left sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
            Overview
          </p>
          <p className="text-sm font-semibold text-white">yoursite.com</p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
          Scan complete
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "GEO score", value: "71" },
          { label: "Understanding", value: "68" },
          { label: "Trend", value: "+6" },
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
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold text-slate-300">
          Modeled assistant visibility
        </p>
        <div className="mt-3 space-y-2.5">
          {[
            { name: "ChatGPT", w: "72%" },
            { name: "Claude", w: "64%" },
            { name: "Gemini", w: "58%" },
            { name: "Perplexity", w: "69%" },
          ].map((row) => (
            <div key={row.name} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-[11px] text-slate-400">
                {row.name}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300"
                  style={{ width: row.w }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VisibilityIndexMock() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220]">
      <div className="border-b border-white/10 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
          AI visibility index
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Example competitive view after a scan — not live rankings inside the
          assistants.
        </p>
      </div>
      <div className="divide-y divide-white/5 px-6 py-2">
        {VISIBILITY_ROWS.map((row) => (
          <div key={row.name} className="flex items-center gap-4 py-4">
            <span
              className={`w-32 shrink-0 text-sm font-medium ${row.you ? "text-sky-300" : "text-slate-300"}`}
            >
              {row.name}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${row.you ? "bg-sky-400" : "bg-violet-400/80"}`}
                style={{ width: `${row.value}%` }}
              />
            </div>
            <span className="w-8 text-right text-sm font-semibold text-white">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SparkleIcon({ className }: { className?: string }) {
  return <Sparkles className={className} />;
}
