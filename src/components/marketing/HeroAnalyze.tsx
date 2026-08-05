"use client";

import { ArrowRight, Star } from "lucide-react";
import { ScanForm } from "@/components/ScanForm";

export function HeroAnalyze() {
  return (
    <section
      id="analyze"
      className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-sky-50/30 to-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(14,165,233,0.12), transparent 45%), radial-gradient(circle at 80% 0%, rgba(56,189,248,0.1), transparent 40%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
            Become the answer in{" "}
            <span className="text-sky-600">AI search</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
            Crawl your site, see how clearly AI can explain what you do, and
            follow a prioritized GEO action plan — built so your business has the
            best chance to appear in ChatGPT, Claude, Gemini, Perplexity, and
            Copilot.
          </p>
          <div className="mt-8 max-w-md [&_.btn-primary]:rounded-full [&_.btn-primary]:bg-sky-500 [&_.btn-primary]:shadow-lg [&_.btn-primary]:shadow-sky-500/25 [&_.btn-primary]:hover:bg-sky-600">
            <ScanForm requireAuth submitLabel="Analyze my site →" />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-0.5 text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <span>Built for teams optimizing generative visibility</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xl shadow-slate-200/60 ring-1 ring-slate-100">
            <ScanPreviewMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function ScanPreviewMock() {
  return (
    <div className="overflow-hidden rounded-xl bg-slate-950 p-4 text-left font-mono text-xs text-slate-300">
      <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-slate-500">geo-archer — scan</span>
      </div>
      <p className="text-sky-400">→ Crawling https://yoursite.com</p>
      <p className="mt-1 text-slate-400">  Pages: 12 / 15 · semantic map building</p>
      <p className="mt-3 text-sky-400">→ AI Understanding Score: 68</p>
      <p className="mt-1 text-slate-400">→ GEO Score: 71 · Visibility run queued</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-sky-500 to-sky-400" />
      </div>
      <p className="mt-2 flex items-center gap-1 text-slate-500">
        <ArrowRight className="h-3 w-3 text-sky-400" />
        8 recommendations ready
      </p>
    </div>
  );
}
