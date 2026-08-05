import { cn } from "@/lib/utils";

/** Product name: GEO Archer (GEO emphasized). */
export function BrandWordmark({
  variant = "light",
  className,
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  if (variant === "dark") {
    return (
      <span
        className={cn("text-lg font-bold tracking-tight text-white", className)}
      >
        <span className="text-sky-400">GEO</span> Archer
      </span>
    );
  }
  return (
    <span className={cn("brand-wordmark", className)}>
      <span className="brand-wordmark-accent">GEO</span> Archer
    </span>
  );
}

export const PRODUCT_NAME = "GEO Archer";
