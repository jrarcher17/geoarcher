import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { listAccountsForConnection } from "@/lib/advertising/connections";
import { googleAdsConfigured, metaAdsConfigured } from "@/lib/advertising/oauth";

/**
 * Connection status for advertising platforms. OAuth credentials are checked
 * server-side only; tokens are never returned to the client.
 */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const connections = await prisma.adPlatformConnection.findMany({
    where: { userId: session.user.id },
    select: {
      platform: true,
      status: true,
      accountId: true,
      accountName: true,
      updatedAt: true,
      error: true,
    },
  });

  const find = (platform: "GOOGLE" | "META") =>
    connections.find((c) => c.platform === platform);
  const google = find("GOOGLE");
  const meta = find("META");

  const [googleAccounts, metaAccounts] = await Promise.all([
    google?.status === "CONNECTED"
      ? listAccountsForConnection(session.user.id, "google")
      : Promise.resolve([]),
    meta?.status === "CONNECTED"
      ? listAccountsForConnection(session.user.id, "meta")
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    google: {
      connected: google?.status === "CONNECTED",
      accountId: google?.accountId ?? null,
      accountName: google?.accountName ?? null,
      accounts: googleAccounts,
      needsAccount: google?.status === "CONNECTED" && !google.accountId,
      error: google?.error ?? null,
      available: googleAdsConfigured(),
    },
    meta: {
      connected: meta?.status === "CONNECTED",
      accountId: meta?.accountId ?? null,
      accountName: meta?.accountName ?? null,
      accounts: metaAccounts,
      needsAccount: meta?.status === "CONNECTED" && !meta.accountId,
      error: meta?.error ?? null,
      available: metaAdsConfigured(),
    },
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    },
  });
}
