import Link from "next/link";

export function StrategyCta() {
  return (
    <section className="border border-slate-200 bg-white p-6 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Done for you
      </p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">
        Want GEO Archer to build your advertising strategy?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        Get more customers from AI and advertising. Share your company and
        website — we store the request and follow up. This does not publish ads
        or invent performance.
      </p>
      <Link href="/strategy" className="btn-primary mt-5 inline-block text-sm">
        Request a strategy
      </Link>
    </section>
  );
}
