import { cn } from "@/lib/utils";

/** Top-level KPI card for advertising dashboards. */
export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** HIGH / MEDIUM / LOW advertising-opportunity badge. */
export function LevelBadge({ level }: { level: string }) {
  const tone =
    level === "HIGH"
      ? "bg-emerald-50 text-emerald-800"
      : level === "MEDIUM"
        ? "bg-sky-50 text-sky-800"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone
      )}
    >
      {level} opportunity
    </span>
  );
}

const CHANNEL_LABELS: Record<string, string> = {
  google: "Google",
  meta: "Meta",
  ai: "AI / ChatGPT",
};

/** Which ad channels suit an opportunity ("ai" renders as coming-soon). */
export function ChannelChips({ channels }: { channels: unknown }) {
  const list = Array.isArray(channels) ? channels.map(String) : [];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((c) => (
        <span
          key={c}
          className={cn(
            "inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-medium",
            c === "ai"
              ? "border-slate-200 bg-slate-50 text-slate-400"
              : "border-slate-200 bg-white text-slate-600"
          )}
        >
          {CHANNEL_LABELS[c] ?? c}
          {c === "ai" && <span className="text-[10px]">· soon</span>}
        </span>
      ))}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  READY: "bg-sky-50 text-sky-800",
  PENDING_APPROVAL: "bg-amber-50 text-amber-800",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  PAUSED: "bg-slate-100 text-slate-500",
  COMPLETED: "bg-slate-100 text-slate-500",
  ARCHIVED: "bg-slate-100 text-slate-500",
  ERROR: "bg-red-50 text-red-700",
};

export function CampaignStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STATUS_TONES[status] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE: "Google",
  META: "Meta",
  AI_CHAT: "AI / ChatGPT",
};

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="inline-flex border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}
