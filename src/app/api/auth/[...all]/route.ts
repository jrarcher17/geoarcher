import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const response = await handler.POST(request);
  if (!response.ok) {
    const body = await response
      .clone()
      .text()
      .catch(() => "");
    console.error("[auth POST]", request.url, response.status, body.slice(0, 500));
  }
  return response;
}
