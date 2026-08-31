import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { listAccountsForConnection } from "@/lib/advertising/connections";
import { googleAdsConfigured, metaAdsConfigured } from "@/lib/advertising/oauth";

/**
 * User ad-account connection status. OAuth tokens stay on the server.
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
      error: true,
    },
  });

  const find = (platform: "GOOGLE" | "META" | "AI_CHAT") =>
    connections.find((c) => c.platform === platform);
  const google = find("GOOGLE");
  const meta = find("META");
  const chatgpt = find("AI_CHAT");

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
    chatgpt: {
      connected: chatgpt?.status === "CONNECTED",
      accountId: chatgpt?.accountId ?? null,
      accountName: chatgpt?.accountName ?? null,
      accounts: [] as { id: string; name: string }[],
      needsAccount: false,
      error: chatgpt?.error ?? null,
      available: true,
    },
  });
}
