import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { disconnectChatgptAds } from "@/lib/advertising/connections";

export async function POST() {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  await disconnectChatgptAds(access.userId);
  return NextResponse.json({ ok: true });
}
