import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteKey: string }> }
) {
  const { siteKey } = await params;
  const site = await prisma.site.findUnique({
    where: { geoKey: siteKey },
    include: { geoConfig: true },
  });
  if (!site?.geoConfig?.enabled) {
    return NextResponse.json(
      { enabled: false, jsonLd: [], meta: {}, version: 0 },
      { headers: corsHeaders }
    );
  }

  const jsonLd = (site.geoConfig.jsonLd as unknown[]) ?? [];
  const meta = (site.geoConfig.meta as Record<string, string>) ?? {};

  return NextResponse.json(
    {
      enabled: true,
      jsonLd,
      meta,
      version: site.geoConfig.updatedAt.getTime(),
    },
    { headers: corsHeaders }
  );
}
