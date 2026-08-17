import { NextResponse } from "next/server";
import { suppress, verifyUnsubscribeToken } from "@/lib/leads/email";

export const dynamic = "force-dynamic";

function htmlPage(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.5rem;color:#0f172a;line-height:1.5}h1{font-size:1.25rem}</style>
</head><body><h1>${title}</h1><p>${body}</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return htmlPage(
      "Unsubscribe link invalid",
      "This unsubscribe link is missing or expired. If you keep getting emails, reply and ask to be removed."
    );
  }

  await suppress(email, "unsubscribe");
  return htmlPage(
    "You're unsubscribed",
    "You won't receive further outreach from GEO Archer on this address."
  );
}
