import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { HeroAnalyze } from "@/components/marketing/HeroAnalyze";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import {
  AUTOPILOT_CARDS,
  FEATURE_CARDS,
  FinalCta,
  MarketingFooter,
  VisibilityIndexMock,
} from "@/components/marketing/MarketingSections";
import { GUIDES } from "@/lib/guides-content";
import {
  resolveProPlusPriceLabel,
  resolveProPriceLabel,
} from "@/lib/billing-price";
import { getPlans } from "@/lib/plans";
import { registrationLoginHref, signUpDisabled } from "@/lib/sign-up-config";
import { formatSiteLimit } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATS = [
  {
    value: "5",
    label: "Assistants modeled",
    detail:
      "ChatGPT, Claude, Gemini, Perplexity, and Copilot — scored from the same crawl so you see where each system is likely to understand you.",
  },
  {
    value: "13",
    label: "GEO score components",
    detail:
      "Clarity, structure, schema, depth, trust, and more. The score is a checklist, not a black box.",
  },
  {
    value: "200",
    label: "Pages per Pro scan",
    detail:
      "Deep crawls for your site and competitors. Free stays focused; Pro and Pro Plus go wide.",
  },
  {
    value: "Loop",
    label: "SEO Autopilot",
    detail:
      "Continuous audits + rankings: recrawl, re-audit, refresh Google positions, and flag what changed — without another manual run.",
  },
] as const;

export default async function Home() {
  const [proPrice, proPlusPrice] = await Promise.all([
    resolveProPriceLabel(),
    resolveProPlusPriceLabel(),
  ]);
  const plans = getPlans();
  const free = plans.free;
  const pro = { ...plans.pro, priceLabel: proPrice };
  const proPlus = { ...plans.proPlus, priceLabel: proPlusPrice };
  const registrationsClosed = signUpDisabled();
  const startFreeHref = registrationLoginHref();

  const pricingRows = [
    {
      label: "Price",
      free: free.priceLabel,
      pro: pro.priceLabel,
      proPlus: proPlus.priceLabel,
    },
    {
      label: "Sites",
      free: formatSiteLimit(free.sites),
      pro: formatSiteLimit(pro.sites),
      proPlus: formatSiteLimit(proPlus.sites),
    },
    {
      label: "Scans / month",
      free: String(free.scansPerMonth),
      pro: String(pro.scansPerMonth),
      proPlus: String(proPlus.scansPerMonth),
    },
    {
      label: "Pages per scan",
      free: String(free.maxPagesPerScan),
      pro: String(pro.maxPagesPerScan),
      proPlus: String(proPlus.maxPagesPerScan),
    },
    {
      label: "Competitor crawl",
      free: String(free.competitorMaxPages),
      pro: String(pro.competitorMaxPages),
      proPlus: String(proPlus.competitorMaxPages),
    },
    {
      label: "AI visibility",
      free: "5 assistants modeled",
      pro: "Full scoring + deep crawl",
      proPlus: "Full scoring + deep crawl",
    },
    {
      label: "SEO Autopilot",
      free: "—",
      pro: "Continuous audits + rankings",
      proPlus: "Continuous audits + rankings",
    },
    {
      label: "Advertising lead generation",
      free: "—",
      pro: "—",
      proPlus: `${proPlus.prospectsPerMonth} prospects / mo`,
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav signUpDisabled={registrationsClosed} />
      <HeroAnalyze />

      <section id="how" className="border-y border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Your website, then GEO Archer.
          </h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "Your website",
              "GEO Archer understands the business",
              "Finds visibility gaps",
              "Fixes what it can",
              "You approve major changes",
              "Monitors Google + AI",
            ].map((step, i) => (
              <li
                key={step}
                className="border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
              >
                <span className="block text-xs font-semibold text-slate-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-2xl text-sm text-slate-500">
            Traditional SEO tools find problems. GEO Archer finds them,
            prioritizes them, helps fix them, and monitors the result.
          </p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Products
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Get seen. Get understood. Get cited.
        </h2>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-sky-200 hover:shadow-lg hover:shadow-sky-900/5"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {card.body}
                </p>
                <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4">
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
        id="autopilot"
        className="bg-slate-950 py-20 text-white"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Pro · SEO Autopilot
          </p>
          <div className="mt-3 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Continuous audits + rankings
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              The first scan is the start. Autopilot keeps watching the site —
              recrawling, re-auditing, and refreshing Google rankings on a
              durable loop.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {AUTOPILOT_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {card.body}
                  </p>
                </div>
              );
            })}
          </div>
          <Link
            href="/settings?tab=billing"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-400 hover:text-sky-300"
          >
            Included on Pro and Pro Plus
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Why it matters
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Built for the shift from links to answers
        </h2>
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start">
          <ol className="space-y-3">
            {STATS.map((stat, i) => (
              <li
                key={stat.label}
                className={`rounded-2xl border px-5 py-4 ${
                  i === STATS.length - 1
                    ? "border-sky-200 bg-sky-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-3xl font-black tracking-tight text-slate-900">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                  {stat.label}
                </p>
              </li>
            ))}
          </ol>
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
              SEO Autopilot
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              Continuous audits + rankings
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {STATS[3].detail}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              One workspace after you paste a URL: dashboard, per-site reports,
              competitor benchmarks, Autopilot history, and PDF exports for
              stakeholders.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Competitive view
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-bold text-white sm:text-4xl">
            See who AI is more likely to mention
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">
            After a scan, compare your GEO and visibility scores against rivals
            on the same crawl budget.
          </p>
          <div className="mt-10">
            <VisibilityIndexMock />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid overflow-hidden rounded-3xl bg-slate-900 lg:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              Typical first scan
            </p>
            <blockquote className="mt-4 text-xl font-medium leading-relaxed text-white sm:text-2xl">
              “ChatGPT could not confidently describe the business. No JSON-LD,
              no FAQ content, thin pages. Those three fixes moved the GEO
              score first.”
            </blockquote>
            <p className="mt-6 text-sm text-slate-400">
              Pattern we see on local and B2B sites — from the same crawl that
              feeds Autopilot.
            </p>
          </div>
          <div className="flex flex-col justify-center border-t border-white/10 p-8 sm:p-12 lg:border-l lg:border-t-0">
            <p className="text-6xl font-black tracking-tight text-sky-400 sm:text-7xl">
              +6
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              GEO trend after a rescan
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Example movement on the dashboard after structured-data and FAQ
              work — your results will differ.
            </p>
          </div>
        </div>
      </section>

      <section id="guides" className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Stay ahead
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              Learn GEO in plain language
            </h2>
          </div>
          <Link
            href="/recommendations"
            className="text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            View in app →
          </Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {GUIDES.map((g) => (
            <Link
              key={g.title}
              href={g.href}
              className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-200 hover:shadow-md"
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

      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Pricing
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Simple plan pricing
            </h2>
            <p className="mt-2 text-slate-500">
              Start free on one site. Scale crawls on Pro. Find customers on
              Pro Plus.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-6 py-4 font-semibold text-slate-500">
                      Package
                    </th>
                    <th className="px-6 py-4 font-semibold text-slate-900">
                      Free
                    </th>
                    <th className="relative px-6 py-4 font-semibold text-slate-900">
                      <span className="absolute -top-px left-6 rounded-b-md bg-sky-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Most popular
                      </span>
                      Pro
                    </th>
                    <th className="relative px-6 py-4 font-semibold text-slate-900">
                      <span className="absolute -top-px left-6 rounded-b-md bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        New
                      </span>
                      Pro Plus
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRows.map((row) => (
                    <tr key={row.label} className="border-b border-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {row.label}
                      </td>
                      <td className="px-6 py-4 text-slate-800">{row.free}</td>
                      <td className="bg-sky-50/40 px-6 py-4 font-medium text-slate-900">
                        {row.pro}
                      </td>
                      <td className="bg-violet-50/40 px-6 py-4 font-medium text-slate-900">
                        {row.proPlus}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-6 py-6" />
                    <td className="px-6 py-6">
                      <Link
                        href={startFreeHref}
                        className="inline-flex w-full justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                      >
                        {registrationsClosed ? "Sign in" : "Start free"}
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
                    <td className="bg-violet-50/40 px-6 py-6">
                      <Link
                        href="/settings?tab=billing"
                        className="inline-flex w-full justify-center rounded-full bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:bg-violet-600 sm:w-auto"
                      >
                        Go Pro Plus
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <FinalCta signUpDisabled={registrationsClosed} />
      <MarketingFooter />
    </div>
  );
}
