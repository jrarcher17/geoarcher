import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---- Shared display helpers for the design system ----

export type Tone = "positive" | "warning" | "critical" | "neutral" | "info";

export function scoreTone(score: number): Tone {
  if (score >= 75) return "positive";
  if (score >= 50) return "warning";
  return "critical";
}

export function gradeFor(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export const toneText: Record<Tone, string> = {
  positive: "text-emerald-600",
  warning: "text-amber-600",
  critical: "text-red-600",
  neutral: "text-slate-500",
  info: "text-sky-600",
};

export const toneBadge: Record<Tone, string> = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
  warning: "bg-amber-50 text-amber-700 border-amber-200/70",
  critical: "bg-red-50 text-red-700 border-red-200/70",
  neutral: "bg-slate-100 text-slate-600 border-slate-200/70",
  info: "bg-sky-50 text-sky-700 border-sky-200/70",
};

export const toneBar: Record<Tone, string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  neutral: "bg-slate-400",
  info: "bg-sky-500",
};

export function impactTone(impact: "high" | "medium" | "low"): Tone {
  return impact === "high" ? "positive" : impact === "medium" ? "info" : "neutral";
}

/** Heuristic estimated GEO gain shown on recommendations. */
export function estimatedGain(impact: "high" | "medium" | "low"): string {
  return impact === "high" ? "+5–8 pts" : impact === "medium" ? "+2–4 pts" : "+1–2 pts";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}

export function formatSiteLimit(sites: number | null): string {
  return sites == null ? "Unlimited" : String(sites);
}
