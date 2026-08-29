const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function strategyInboxEmails(): string[] {
  return (process.env.STRATEGY_INBOX_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isStrategyInbox(email: string): boolean {
  return strategyInboxEmails().includes(email.trim().toLowerCase());
}

export function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    if (!url.hostname.includes(".")) return null;
    if (url.hostname === "localhost") return null;
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return null;
  }
}

export function parseBudgetDollars(raw: unknown): number | null | "invalid" {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[,$\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) return "invalid";
  return Math.round(n * 100);
}

export function parseStrategyInput(body: unknown):
  | {
      name: string;
      email: string;
      company: string;
      website: string;
      monthlyAdBudgetCents: number | null;
    }
  | { error: string } {
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const company = typeof o.company === "string" ? o.company.trim() : "";
  const website = normalizeWebsite(typeof o.website === "string" ? o.website : "");
  const budget = parseBudgetDollars(o.monthlyAdBudget);

  if (name.length < 2 || name.length > 80) {
    return { error: "Enter your name." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (company.length < 2 || company.length > 120) {
    return { error: "Enter your company name." };
  }
  if (!website) {
    return { error: "Enter a website URL." };
  }
  if (budget === "invalid") {
    return { error: "Monthly ad budget must be a number greater than zero." };
  }

  return {
    name,
    email,
    company,
    website,
    monthlyAdBudgetCents: budget,
  };
}
