import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";

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

  return NextResponse.json({
    google: {
      connected: google?.status === "CONNECTED",
      accountName: google?.accountName ?? null,
      error: google?.error ?? null,
      // OAuth app credentials present on the server → the Connect flow can run.
      available: Boolean(
        process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET
      ),
    },
    meta: {
      connected: meta?.status === "CONNECTED",
      accountName: meta?.accountName ?? null,
      error: meta?.error ?? null,
      available: Boolean(
        process.env.META_ADS_APP_ID && process.env.META_ADS_APP_SECRET
      ),
    },
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    },
  });
}
