import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { disconnectPlatform } from "@/lib/advertising/connections";
import { parsePlatform } from "@/lib/advertising/oauth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const { platform: raw } = await params;
  const platform = parsePlatform(raw);
  if (!platform) {
    return NextResponse.json({ error: "Unknown platform." }, { status: 404 });
  }

  await disconnectPlatform(access.userId, platform);
  return NextResponse.json({ ok: true });
}
