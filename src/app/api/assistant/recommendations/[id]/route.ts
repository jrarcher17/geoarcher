import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdAccess } from "@/lib/advertising/api-guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  if (body?.status !== "DISMISSED") {
    return NextResponse.json({ error: "Only dismiss is supported here." }, { status: 400 });
  }

  const rec = await prisma.aIRecommendation.findUnique({ where: { id } });
  if (!rec || rec.userId !== access.userId) {
    return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
  }

  await prisma.aIRecommendation.update({
    where: { id },
    data: { status: "DISMISSED" },
  });
  return NextResponse.json({ ok: true });
}
