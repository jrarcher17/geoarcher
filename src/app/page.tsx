import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { HeroAnalyze } from "@/components/marketing/HeroAnalyze";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import {
  DashboardMock,
  FEATURE_CARDS,
  FinalCta,
  MarketingFooter,
  PLATFORM_POINTS,
} from "@/components/marketing/MarketingSections";
import { GUIDES } from "@/lib/guides-content";
import { resolveProPriceLabel } from "@/lib/billing-price";
import { getPlans } from "@/lib/plans";
import { formatSiteLimit } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const proPrice = await resolveProPriceLabel();
  const plans = getPlans();
  const free = plans.free;
  const pro = { ...plans.pro, priceLabel: proPrice };

  const pricingRows = [
    { label: "Price", free: free.priceLabel, pro: pro.priceLabel },
    {
      label: "Sites",
      free: formatSiteLimit(free.sites),
      pro: formatSiteLimit(pro.sites),
    },
    {
      label: "Scans / month",
      free: String(free.scansPerMonth),
      pro: String(pro.scansPerMonth),
    },
    {
      label: "Pages per scan",
      free: String(free.maxPagesPerScan),
      pro: String(pro.maxPagesPerScan),
    },
    {
      label: "Competitor crawl",
      free: String(free.competitorMaxPages),
      pro: String(pro.competitorMaxPages),
    },
    {
      label: "AI visibility",
      free: "5 assistants modeled",
      pro: "Full scoring + deep crawl",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav />
      <HeroAnalyze />

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-sky-600">
          Features
        </p>
        <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Everything you need to win generative answers
        </h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`flex flex-col rounded-3xl border p-8 ${card.tint} transition hover:shadow-lg hover:shadow-slate-200/50`}
              >
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconClass}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {card.body}
                </p>
                <ul className="mt-4 space-y-2 border-t border-black/5 pt-4">
                  {card.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-center gap-2 text-xs font-medium text-slate-600"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section
        id="platform"
        className="border-y border-slate-100 bg-gradient-to-b from-slate-50/80 to-white py-20"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              One workspace to crawl, score, and ship fixes
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              One signed-in workspace: executive dashboard, per-site reports,
              competitor benchmarks, exports, and billing — everything you need
              after you analyze a URL.
            </p>
            <ul className="mt-8 space-y-3">
              {PLATFORM_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <Check className="h-3 w-3" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <DashboardMock />
        </div>
      </section>

      <section id="guides" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Learn GEO in plain language
            </h2>
            <p className="mt-2 text-slate-500">
              Concepts behind the scores you see in every scan.
            </p>
          </div>
          <Link
            href="/recommendations"
            className="text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            View in app →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {GUIDES.map((g) => (
            <Link
              key={g.title}
              href={g.href}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-200 hover:shadow-md"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                {g.tag}
              </span>
              <h3 className="mt-3 font-semibold text-slate-900 group-hover:text-sky-700">
                {g.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                {g.summary}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-600">
                Read more <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section id="pricing" className="bg-slate-50/80 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">Simple plan pricing</h2>
            <p className="mt-2 text-slate-500">
              Start free on one site. Scale crawls and volume on Pro.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-6 py-4 font-semibold text-slate-500">Package</th>
                    <th className="px-6 py-4 font-semibold text-slate-900">Free</th>
                    <th className="relative px-6 py-4 font-semibold text-slate-900">
                      <span className="absolute -top-px left-6 rounded-b-md bg-sky-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Most popular
                      </span>
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRows.map((row) => (
                    <tr key={row.label} className="border-b border-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-600">{row.label}</td>
                      <td className="px-6 py-4 text-slate-800">{row.free}</td>
                      <td className="bg-sky-50/40 px-6 py-4 font-medium text-slate-900">
                        {row.pro}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-6 py-6" />
                    <td className="px-6 py-6">
                      <Link
                        href="/login?sign-up=1"
                        className="inline-flex w-full justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                      >
                        Start free
                      </Link>
                    </td>
                    <td className="bg-sky-50/40 px-6 py-6">
                      <Link
                        href="/settings?tab=billing"
                        className="inline-flex w-full justify-center rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/25 transition hover:bg-sky-600 sm:w-auto"
                      >
                        Upgrade to Pro
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <FinalCta />
      <MarketingFooter />
    </div>
  );
}
