import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A single narrative insight from the AI analysis. */
export function AIInsightCard({
  title,
  insight,
  meta,
  className,
}: {
  title: string;
  insight: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "border-sky-100 bg-gradient-to-br from-sky-50/70 via-white to-white p-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            {title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{insight}</p>
          {meta && <div className="mt-3">{meta}</div>}
        </div>
      </div>
    </Card>
  );
}
