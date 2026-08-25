import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/stripe";

/**
 * Outreach sending via Resend, with the deliverability guardrails that keep
 * the platform's sending reputation intact: suppression list, daily cap,
 * CAN-SPAM footer with a working unsubscribe link.
 */

export function resendConfigured(): boolean {
  return Boolean(
    process.env["RESEND_API_KEY"]?.trim() &&
      process.env["LEADGEN_FROM_EMAIL"]?.trim()
  );
}

export function dailySendCap(): number {
  const n = Number(process.env["LEADGEN_DAILY_SEND_CAP"]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}

export function followUpDays(): number {
  const n = Number(process.env["LEADGEN_FOLLOWUP_DAYS"]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 4;
}

// ---- Suppression list ----

export async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.emailSuppression.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return Boolean(row);
}

export async function suppress(email: string, reason: string): Promise<void> {
  await prisma.emailSuppression.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), reason },
    update: { reason },
  });
}

// ---- Unsubscribe tokens (HMAC so the endpoint can't be abused) ----

function unsubscribeSecret(): string {
  return (
    process.env["RESEND_WEBHOOK_SECRET"]?.trim() ||
    process.env["BETTER_AUTH_SECRET"]?.trim() ||
    "geo-archer-leadgen"
  );
}

export function unsubscribeToken(email: string): string {
  return createHmac("sha256", unsubscribeSecret())
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string): string {
  const params = new URLSearchParams({
    email: email.toLowerCase(),
    token: unsubscribeToken(email),
  });
  return `${appBaseUrl()}/api/leads/unsubscribe?${params.toString()}`;
}

// ---- Daily cap ----

export async function countSentTodayForUser(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  return prisma.outreachEmail.count({
    where: {
      sentAt: { gte: startOfDay },
      prospect: { campaign: { userId } },
    },
  });
}

// ---- Sending ----

export interface SendOutreachInput {
  to: string;
  subject: string;
  body: string;
  /** Replies go straight to the GEO Archer customer's own inbox. */
  replyTo: string;
  senderName: string;
}

function buildFooter(to: string, senderName: string): string {
  const postal = process.env["LEADGEN_POSTAL_ADDRESS"]?.trim();
  return [
    "",
    "—",
    `Sent by ${senderName} via GEO Archer.`,
    postal ?? "",
    `Don't want emails like this? Unsubscribe: ${unsubscribeUrl(to)}`,
  ]
    .filter((line, i) => i < 2 || line.length > 0)
    .join("\n");
}

/** Internal notice (no unsubscribe footer) — e.g. a prospect requested help. */
export async function sendInternalEmail(input: {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  const from = process.env["LEADGEN_FROM_EMAIL"]?.trim();
  if (!apiKey || !from) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
      ...(input.replyTo ? { reply_to: [input.replyTo] } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend notify failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

/** Send one outreach email through Resend. Returns the Resend email id. */
export async function sendViaResend(input: SendOutreachInput): Promise<string> {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  const from = process.env["LEADGEN_FROM_EMAIL"]?.trim();
  if (!apiKey || !from) {
    throw new Error("Resend is not configured (RESEND_API_KEY, LEADGEN_FROM_EMAIL).");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: `${input.body}\n${buildFooter(input.to, input.senderName)}`,
      reply_to: [input.replyTo],
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl(input.to)}>`,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Resend returned no email id.");
  return data.id;
}

// ---- Webhook signature verification (svix scheme used by Resend) ----

export function verifyResendWebhook(
  payload: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null }
): boolean {
  const secret = process.env["RESEND_WEBHOOK_SECRET"]?.trim();
  if (!secret) return false;
  if (!headers.id || !headers.timestamp || !headers.signature) return false;

  // Reject stale timestamps (replay protection, 5 minute window).
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${headers.id}.${headers.timestamp}.${payload}`;
  const expected = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // Header format: "v1,<sig> v1,<sig2> ..."
  for (const part of headers.signature.split(" ")) {
    const [, sig] = part.split(",");
    if (!sig) continue;
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}
