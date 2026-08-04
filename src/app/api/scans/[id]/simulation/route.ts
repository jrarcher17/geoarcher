import { NextResponse, after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { runSimulation } from "@/lib/simulation";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { simulation: true },
  });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }
  if (scan.status !== "COMPLETE") {
    return NextResponse.json(
      { error: "Scan must be complete before running a simulation." },
      { status: 409 }
    );
  }
  if (scan.simulation?.status === "RUNNING") {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  // Reset any previous (failed or stale) simulation and start fresh.
  await prisma.simulation.upsert({
    where: { scanId: id },
    update: {
      status: "RUNNING",
      error: null,
      results: Prisma.DbNull,
      finishedAt: null,
    },
    create: { scanId: id },
  });

  after(() => runSimulation(id));

  return NextResponse.json({ ok: true }, { status: 202 });
}
