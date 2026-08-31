import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { connectChatgptAds } from "@/lib/advertising/connections";

/** Store an OpenAI Ads Manager API key after verifying GET /ad_account. */
export async function POST(request: Request) {
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = (await request.json().catch(() => null)) as {
    apiKey?: unknown;
  } | null;
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey : "";

  try {
    const account = await connectChatgptAds(access.userId, apiKey);
    return NextResponse.json({
      ok: true,
      accountId: account.id,
      accountName: account.name,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not connect ChatGPT Ads.",
      },
      { status: 400 }
    );
  }
}
