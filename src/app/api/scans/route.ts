import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { startScanPipeline } from "@/lib/jobs/start";
import { assertCanAddSite, assertCanStartScan } from "@/lib/user-plan";

export const maxDuration = 800;

function normalizeSiteUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in required to start a scan." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const siteUrl = normalizeSiteUrl(typeof body?.url === "string" ? body.url : "");
  if (!siteUrl) {
    return NextResponse.json(
      { error: "Please enter a valid website URL." },
      { status: 400 }
    );
  }

  const site = await prisma.site.upsert({
    where: { url: siteUrl },
    update: {},
    create: { url: siteUrl },
  });

  const existingLink = await prisma.userSite.findUnique({
    where: {
      userId_siteId: { userId: session.user.id, siteId: site.id },
    },
  });
  if (!existingLink) {
    const limitError = await assertCanAddSite(session.user.id);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 403 });
    }
  }
  const scanLimitError = await assertCanStartScan(session.user.id);
  if (scanLimitError) {
    return NextResponse.json({ error: scanLimitError }, { status: 403 });
  }

  const scan = await prisma.scan.create({
    data: { siteId: site.id },
  });

  await prisma.userSite.upsert({
    where: {
      userId_siteId: { userId: session.user.id, siteId: site.id },
    },
    update: {},
    create: { userId: session.user.id, siteId: site.id },
  });

  await startScanPipeline({
    scanId: scan.id,
    siteId: site.id,
  });

  return NextResponse.json({ scanId: scan.id }, { status: 201 });
}
