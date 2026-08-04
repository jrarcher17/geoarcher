import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteKey: string }> }
) {
  const { siteKey } = await params;
  const site = await prisma.site.findUnique({ where: { geoKey: siteKey } });
  if (!site) {
    return NextResponse.json({ error: "Unknown site." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const pageUrl = typeof body.url === "string" ? body.url.slice(0, 2000) : "";

  if (pageUrl) {
    await prisma.geoHit.create({
      data: { siteId: site.id, pageUrl },
    });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
