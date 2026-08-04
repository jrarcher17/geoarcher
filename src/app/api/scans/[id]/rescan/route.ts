import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { runScan } from "@/lib/scan-runner";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = await prisma.scan.findUnique({ where: { id } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const active = await prisma.scan.findFirst({
    where: {
      siteId: scan.siteId,
      status: { in: ["QUEUED", "CRAWLING", "ANALYZING"] },
    },
  });
  if (active) {
    return NextResponse.json(
      { error: "A scan is already running for this site.", scanId: active.id },
      { status: 409 }
    );
  }

  const newScan = await prisma.scan.create({
    data: { siteId: scan.siteId },
  });

  after(() => runScan(newScan.id));

  return NextResponse.json({ scanId: newScan.id }, { status: 201 });
}
