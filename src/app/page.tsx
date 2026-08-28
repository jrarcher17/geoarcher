import Link from "next/link";
import { Check } from "lucide-react";
import { HeroAnalyze } from "@/components/marketing/HeroAnalyze";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import {
  CONTROL_CARDS,
  FEATURE_CARDS,
  FinalCta,
  MarketingFooter,
} from "@/components/marketing/MarketingSections";
import {
  resolveProPlusPriceLabel,
  resolveProPriceLabel,
} from "@/lib/billing-price";
import { getPlans } from "@/lib/plans";
import { registrationLoginHref, signUpDisabled } from "@/lib/sign-up-config";
import { formatSiteLimit } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STEPS = [
  "Add a website",
  "Scan and understand the business",
  "Identify products and services",
  "Generate Google and Meta ads",
  "Review and approve",
  "Publish when you're ready",
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
      label: "Site Intelligence",
      free: "Business, offerings, images",
      pro: "Business, offerings, images",
      proPlus: "Business, offerings, images",
    },
    {
      label: "Ad Studio + campaigns",
      free: "—",
      pro: "Google and Meta drafts",
      proPlus: "Google and Meta drafts",
    },
    {
      label: "Publish & analytics",
      free: "—",
      pro: "When accounts are connected",
      proPlus: "When accounts are connected",
    },
    {
      label: "AI Assistant",
      free: "—",
      pro: "Approval before spend",
      proPlus: "Approval before spend",
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
            Website in. Campaigns out.
          </h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, i) => (
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
            The scan is the foundation. AI writes ads from what the site
            already says. Google and Meta distribute them. Analytics only
            shows numbers after a campaign actually runs.
          </p>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
          Product
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          An advertising operating system, not another audit report.
        </h2>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-violet-200 hover:shadow-lg hover:shadow-violet-900/5"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
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
                      <Check className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            Control
          </p>
          <div className="mt-3 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI can propose. You approve anything that spends.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              The assistant reads your live campaigns and opportunities. Pause,
              publish, and budget changes wait in an approval trail. We do not
              invent performance.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {CONTROL_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
          Who it&apos;s for
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Your site — or the next business you find.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="border border-slate-200 bg-white p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              In-house
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              Advertise what you already sell
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Add your website, review the offerings we found, and generate
              campaigns in Ad Studio. Connect Google or Meta when you want
              them live.
            </p>
          </div>
          <div className="border border-slate-200 bg-white p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Agencies
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              Find businesses that need ads
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Lead Generation scores advertising opportunity, then opens the
              same scan → Ad Studio path for each prospect.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
              Pricing
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Start with a scan. Advertise on Pro.
            </h2>
            <p className="mt-2 text-slate-500">
              Free includes one site and intelligence. Pro unlocks Ad Studio,
              campaigns, and the assistant. Pro Plus adds lead generation.
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
                      <span className="absolute -top-px left-6 rounded-b-md bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Most popular
                      </span>
                      Pro
                    </th>
                    <th className="px-6 py-4 font-semibold text-slate-900">
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
                      <td className="bg-violet-50/40 px-6 py-4 font-medium text-slate-900">
                        {row.pro}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
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
                    <td className="bg-violet-50/40 px-6 py-6">
                      <Link
                        href="/settings?tab=billing"
                        className="inline-flex w-full justify-center rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700 sm:w-auto"
                      >
                        Upgrade to Pro
                      </Link>
                    </td>
                    <td className="px-6 py-6">
                      <Link
                        href="/settings?tab=billing"
                        className="inline-flex w-full justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
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
