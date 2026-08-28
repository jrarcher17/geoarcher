export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { notation: n >= 10_000 ? "compact" : "standard" }).format(n);
}

export function formatRoas(roas: number | null | undefined): string {
  if (roas == null) return "—";
  return `${roas.toFixed(2)}x`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
