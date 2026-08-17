import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { suppress, verifyResendWebhook } from "@/lib/leads/email";

export const runtime = "nodejs";

interface ResendEvent {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
  };
}

export async function POST(request: Request) {
  const payload = await request.text();
  const ok = verifyResendWebhook(payload, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  });
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(payload) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const resendId = event.data?.email_id;
  if (!resendId) {
    return NextResponse.json({ received: true });
  }

  const email = await prisma.outreachEmail.findUnique({
    where: { resendId },
    select: { id: true, prospectId: true, status: true },
  });
  if (!email) {
    return NextResponse.json({ received: true });
  }

  const now = new Date();
  const to = event.data?.to?.[0];

  switch (event.type) {
    case "email.delivered":
      if (email.status === "SENT") {
        await prisma.outreachEmail.update({
          where: { id: email.id },
          data: { status: "DELIVERED", deliveredAt: now },
        });
      }
      break;
    case "email.opened":
      if (["SENT", "DELIVERED"].includes(email.status)) {
        await prisma.outreachEmail.update({
          where: { id: email.id },
          data: { status: "OPENED", openedAt: now },
        });
      }
      break;
    case "email.bounced":
    case "email.complained": {
      await prisma.outreachEmail.update({
        where: { id: email.id },
        data: { status: "BOUNCED", bouncedAt: now },
      });
      await prisma.prospect.update({
        where: { id: email.prospectId },
        data: { status: "BOUNCED" },
      });
      if (to) {
        await suppress(
          to,
          event.type === "email.complained" ? "complaint" : "bounce"
        );
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
