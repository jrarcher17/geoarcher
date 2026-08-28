"use client";

import { ScanForm } from "@/components/ScanForm";
import { HeroDashboardMock } from "@/components/marketing/MarketingSections";

const ASSISTANTS = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot"];

export function HeroAnalyze() {
  return (
    <section
      id="analyze"
      className="relative overflow-hidden bg-gradient-to-b from-sky-50/80 via-white to-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgba(14,165,233,0.16), transparent 55%)",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-4 pb-6 pt-16 text-center sm:px-6 sm:pt-20 lg:pt-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          AI visibility operating system
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
          Get found by Google.
          <br />
          Get mentioned by AI.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          GEO Archer continuously analyzes and improves your website&apos;s SEO
          and AI search visibility—without forcing you to rebuild the site or
          create dozens of unnecessary pages.
        </p>
        <div className="mx-auto mt-8 max-w-xl text-left [&_.btn-primary]:rounded-full [&_.input-field]:bg-white">
          <ScanForm requireAuth submitLabel="Analyze My Website Free" />
        </div>
        <p className="mt-4 text-sm text-slate-500">
          <a href="#how" className="font-medium text-slate-800 underline-offset-4 hover:underline">
            See How It Works
          </a>
        </p>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-6 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-sky-900/10 ring-1 ring-slate-100">
          <HeroDashboardMock />
        </div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Modeled across the assistants your buyers use
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-slate-400">
          {ASSISTANTS.map((name) => (
            <span key={name} className="tracking-tight">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
