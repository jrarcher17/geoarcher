import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { runScan } from "@/lib/scan-runner";
import { getServerSession } from "@/lib/session";
import { assertCanStartScan, userOwnsScan } from "@/lib/user-plan";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const scan = await prisma.scan.findUnique({ where: { id } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  if (!(await userOwnsScan(session.user.id, id))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const scanLimitError = await assertCanStartScan(session.user.id);
  if (scanLimitError) {
    return NextResponse.json({ error: scanLimitError }, { status: 403 });
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

  after(async () => {
    await runScan(newScan.id);
  });

  return NextResponse.json({ scanId: newScan.id }, { status: 201 });
}
