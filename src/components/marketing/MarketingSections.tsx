import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Globe,
  Radar,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandWordmark } from "@/components/BrandWordmark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <BrandWordmark />
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            GEO Archer helps you see your website the way AI assistants do —
            then fix what they cannot cite.
          </p>
        </div>
        {[
          {
            title: "Product",
            links: [
              { href: "/#features", label: "Features" },
              { href: "/#pricing", label: "Pricing" },
              { href: "/#guides", label: "Guides" },
              { href: "/login", label: "Sign in" },
            ],
          },
          {
            title: "Legal",
            links: [
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

export function FinalCta() {
  return (
    <section className="mx-4 mb-16 sm:mx-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-900 px-8 py-14 text-center shadow-xl sm:px-16">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Ready to see how AI understands your site?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Run your first crawl in minutes. Free tier includes full scoring on one
          site — upgrade when you need depth and volume.
        </p>
        <Link
          href="/login?sign-up=1"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-sky-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
        >
          Get started for free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export const FEATURE_CARDS = [
  {
    icon: Globe,
    tint: "bg-sky-50 border-sky-100",
    iconClass: "text-sky-600 bg-sky-100",
    title: "AI website crawl",
    body: "GEO-powered crawl builds the semantic map assistants infer: topics, entities, and gaps — not just a page list.",
    bullets: ["Up to 150 pages on Pro", "Schema & technical audit", "Page-level health"],
  },
  {
    icon: Radar,
    tint: "bg-violet-50 border-violet-100",
    iconClass: "text-violet-600 bg-violet-100",
    title: "Visibility & GEO scores",
    body: "Understanding score, 13-component GEO score, and modeled visibility across ChatGPT, Claude, Gemini, Perplexity, and Copilot.",
    bullets: ["Executive dashboard KPIs", "Trend over rescans", "Simulation prompts"],
  },
  {
    icon: Users,
    tint: "bg-sky-50 border-sky-100",
    iconClass: "text-sky-600 bg-sky-100",
    title: "Competitor benchmarks",
    body: "Compare your scores against up to five rival sites on the same crawl budget — see where assistants would prefer them.",
    bullets: ["Side-by-side scores", "500-page competitor budget", "Gap-driven actions"],
  },
] as const;

export const PLATFORM_POINTS = [
  "Sites workspace with 10-tab reports per property",
  "Recommendations, content opportunities, and one-click drafts",
  "PDF exports and scan history for stakeholders",
  "Plan limits: scans/month, pages per scan, and site caps",
] as const;

export function DashboardMock() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">Usage summary</span>
        <BarChart3 className="h-4 w-4 text-sky-500" />
      </div>
      <div className="flex items-end gap-2 h-32">
        {[40, 65, 52, 78, 71, 88, 74].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-gradient-to-t from-sky-500 to-sky-300 opacity-90"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 py-2">
          <p className="font-bold text-slate-800">71</p>
          <p className="text-slate-500">GEO</p>
        </div>
        <div className="rounded-lg bg-slate-50 py-2">
          <p className="font-bold text-slate-800">68</p>
          <p className="text-slate-500">Understand</p>
        </div>
        <div className="rounded-lg bg-slate-50 py-2">
          <p className="font-bold text-sky-600">+6</p>
          <p className="text-slate-500">Trend</p>
        </div>
      </div>
    </div>
  );
}

export function SparkleIcon({ className }: { className?: string }) {
  return <Sparkles className={className} />;
}
