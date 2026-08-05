import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, gradeFor, scoreTone, toneText } from "@/lib/utils";

/**
 * One score, one explanation, one trend. The core KPI unit.
 */
export function ScoreCard({
  label,
  score,
  explanation,
  delta,
  suffix = "",
  showGrade = false,
  icon,
  className,
}: {
  label: string;
  score: number | null;
  explanation: string;
  /** Change vs previous period; null hides the trend chip. */
  delta?: number | null;
  suffix?: string;
  showGrade?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const tone = score != null ? scoreTone(score) : "neutral";
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={cn(
            "text-3xl font-bold tracking-tight",
            score != null ? toneText[tone] : "text-slate-300"
          )}
        >
          {score != null ? `${score}${suffix}` : "—"}
        </span>
        {showGrade && score != null && (
          <span className="text-sm font-semibold text-slate-400">
            Grade {gradeFor(score)}
          </span>
        )}
        {delta != null && delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              delta > 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600"
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta)}
          </span>
        )}
        {delta === 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
            <Minus className="h-3 w-3" /> flat
          </span>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{explanation}</p>
    </Card>
  );
}
