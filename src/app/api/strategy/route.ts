import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { isStrategyInbox, parseStrategyInput } from "@/lib/strategy";

const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function serialize(row: {
  id: string;
  name: string;
  email: string;
  company: string;
  website: string;
  monthlyAdBudgetCents: number | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    website: row.website,
    monthlyAdBudgetCents: row.monthlyAdBudgetCents,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Public inbound strategy request. Stores the lead — does not create a campaign. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.websiteExtra === "string" && body.websiteExtra.trim()) {
    return NextResponse.json({ received: true });
  }

  const parsed = parseStrategyInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const recent = await prisma.strategyRequest.findFirst({
    where: {
      email: parsed.email,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true, createdAt: true },
  });
  if (recent) {
    return NextResponse.json(
      {
        error: "We already have a recent request from this email.",
        received: true,
        id: recent.id,
      },
      { status: 409 }
    );
  }

  const session = await getServerSession();
  const created = await prisma.strategyRequest.create({
    data: {
      ...parsed,
      userId: session?.user.id ?? null,
    },
  });

  return NextResponse.json({ received: true, request: serialize(created) }, { status: 201 });
}

/** Signed-in user: own requests. Operator email: every stored request. */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const inbox = isStrategyInbox(session.user.email);
  const email = session.user.email.trim().toLowerCase();
  const rows = await prisma.strategyRequest.findMany({
    where: inbox
      ? {}
      : { OR: [{ userId: session.user.id }, { email }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    inbox,
    requests: rows.map(serialize),
  });
}
