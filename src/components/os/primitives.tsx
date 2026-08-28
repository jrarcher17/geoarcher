import Link from "next/link";
import { cn } from "@/lib/utils";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="border border-slate-200 bg-white px-6 py-12 text-center sm:px-10">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {body}
      </p>
      <Link href={actionHref} className="btn-primary mt-6 inline-block">
        {actionLabel}
      </Link>
    </div>
  );
}

export function ConnectState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="border border-dashed border-slate-300 bg-white px-6 py-10 sm:px-8">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
        {body}
      </p>
      <p className="mt-4 text-xs font-medium text-slate-400">
        Not connected yet — this is a planned integration, not live data.
      </p>
    </div>
  );
}

export function EngineBar({
  name,
  score,
}: {
  name: string;
  score: number | null;
}) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
      <span className="truncate text-sm text-slate-600">{name}</span>
      <div
        className="h-1.5 overflow-hidden bg-slate-100"
        role="progressbar"
        aria-valuenow={score ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name} visibility`}
      >
        <div
          className="h-full bg-slate-900 transition-[width] duration-500"
          style={{ width: score == null ? "0%" : `${pct}%` }}
        />
      </div>
      <span className="text-right text-sm tabular-nums text-slate-700">
        {score == null ? "—" : `${Math.round(score)}%`}
      </span>
    </div>
  );
}

export function ImpactBadge({ impact }: { impact: string }) {
  const tone =
    impact === "high"
      ? "bg-amber-50 text-amber-800"
      : impact === "medium"
        ? "bg-sky-50 text-sky-800"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone
      )}
    >
      {impact} impact
    </span>
  );
}

export function WorkRow({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center text-[10px]",
          done ? "text-emerald-600" : "text-slate-300"
        )}
        aria-hidden
      >
        {done ? "✓" : "●"}
      </span>
      <span className={done ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </li>
  );
}
