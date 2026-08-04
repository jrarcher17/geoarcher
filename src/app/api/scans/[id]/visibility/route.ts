import { NextResponse, after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { runVisibilityReport } from "@/lib/visibility";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { visibility: true },
  });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }
  if (scan.status !== "COMPLETE") {
    return NextResponse.json(
      { error: "Scan must be complete before scoring visibility." },
      { status: 409 }
    );
  }
  if (scan.visibility?.status === "RUNNING") {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  await prisma.visibilityReport.upsert({
    where: { scanId: id },
    update: {
      status: "RUNNING",
      error: null,
      results: Prisma.DbNull,
      finishedAt: null,
    },
    create: { scanId: id },
  });

  after(() => runVisibilityReport(id));

  return NextResponse.json({ ok: true }, { status: 202 });
}
