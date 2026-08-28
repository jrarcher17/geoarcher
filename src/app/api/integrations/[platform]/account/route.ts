import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { selectAccount } from "@/lib/advertising/connections";
import { parsePlatform } from "@/lib/advertising/oauth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const { platform: raw } = await params;
  const platform = parsePlatform(raw);
  if (!platform) {
    return NextResponse.json({ error: "Unknown platform." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";
  const accountName =
    typeof body?.accountName === "string" ? body.accountName.trim() : accountId;
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required." }, { status: 400 });
  }

  await selectAccount(access.userId, platform, accountId, accountName);
  return NextResponse.json({ ok: true, accountId, accountName });
}
