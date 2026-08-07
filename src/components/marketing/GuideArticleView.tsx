import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { GuideChartBlock } from "@/components/marketing/GuideCharts";
import type { GuideArticle } from "@/lib/guides-content";
import { GUIDES_LIST } from "@/lib/guides-content";

export function GuideArticleView({ guide }: { guide: GuideArticle }) {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/#guides"
        className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All guides
      </Link>

      <p className="mt-8 text-[10px] font-bold uppercase tracking-wider text-sky-600">
        {guide.tag}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
        {guide.title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{guide.readMinutes} min read · GEO Archer field guide</p>
      <p className="mt-5 text-lg leading-relaxed text-slate-600">{guide.summary}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {guide.heroStats.map((s) => (
          <div
            key={s.label}
            className="rounded-none border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-3xl font-bold tracking-tight text-sky-600">{s.value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{s.label}</p>
            {s.detail && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.detail}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 flex gap-4 rounded-none border border-amber-200 bg-amber-50/80 p-5 sm:p-6">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold text-amber-950">{guide.urgency.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90">{guide.urgency.body}</p>
        </div>
      </div>

      <GuideChartBlock chart={guide.chart} />

      <div className="space-y-12">
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">{section.heading}</h2>
            <p className="mt-4 leading-relaxed text-slate-600">{section.body}</p>
            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-4 space-y-2">
                {section.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {guide.framework && (
        <div className="mt-12 rounded-none border border-slate-200 bg-slate-900 p-6 text-white sm:p-8">
          <h2 className="text-lg font-semibold">{guide.framework.title}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {guide.framework.items.map((item) => (
              <div key={item.name} className="rounded-none bg-white/10 p-4">
                <p className="font-semibold text-sky-300">{item.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <blockquote className="mt-12 border-l-4 border-sky-500 bg-sky-50/50 py-4 pl-6 pr-4">
        <p className="text-lg font-medium leading-relaxed text-slate-800">
          &ldquo;{guide.pullQuote.text}&rdquo;
        </p>
        <footer className="mt-3 text-sm text-slate-500">— {guide.pullQuote.attribution}</footer>
      </blockquote>

      <div className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Sources & further reading
        </h2>
        <ul className="mt-4 space-y-3">
          {guide.sources.map((s) => (
            <li key={s.label} className="text-sm leading-relaxed">
              {s.href ? (
                <a
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="font-medium text-sky-600 hover:text-sky-700 hover:underline"
                >
                  {s.label}
                </a>
              ) : (
                <span className="font-medium text-slate-800">{s.label}</span>
              )}
              <span className="text-slate-500"> — {s.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-400">
          Chart data on this page uses illustrative benchmarks unless labeled otherwise.
          Your GEO Archer scan reflects your live site.
        </p>
      </div>

      <div className="mt-14 rounded-none border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-8 shadow-sm">
        <p className="text-xl font-bold text-slate-900">{guide.cta.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{guide.cta.body}</p>
        <Link
          href="/#analyze"
          className="mt-6 inline-flex rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-600"
        >
          {guide.cta.button}
        </Link>
      </div>

      <div className="mt-14 border-t border-slate-200 pt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          More guides
        </h2>
        <ul className="mt-4 space-y-3">
          {GUIDES_LIST.filter((g) => g.slug !== guide.slug).map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="font-medium text-sky-600 hover:text-sky-700"
              >
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
