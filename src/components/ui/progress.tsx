import { cn, scoreTone, toneBar } from "@/lib/utils";

export function Progress({
  value,
  className,
  toned = true,
}: {
  value: number;
  className?: string;
  /** Color by score threshold; false = always sky. */
  toned?: boolean;
}) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-slate-100",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          toned ? toneBar[scoreTone(value)] : "bg-sky-500"
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
