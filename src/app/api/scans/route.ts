import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { runScan } from "@/lib/scan-runner";
import { getServerSession } from "@/lib/session";

export const maxDuration = 300;

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
  const scan = await prisma.scan.create({
    data: { siteId: site.id },
  });

  const session = await getServerSession();
  if (session) {
    await prisma.userSite.upsert({
      where: {
        userId_siteId: { userId: session.user.id, siteId: site.id },
      },
      update: {},
      create: { userId: session.user.id, siteId: site.id },
    });
  }

  after(() => runScan(scan.id));

  return NextResponse.json({ scanId: scan.id }, { status: 201 });
}
