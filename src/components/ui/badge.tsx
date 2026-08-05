import { cn, toneBadge, type Tone } from "@/lib/utils";

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneBadge[tone],
        className
      )}
      {...props}
    />
  );
}
