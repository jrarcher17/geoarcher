import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "@/lib/session";

/** Remove a competitor. AI suggestions are dismissed so rediscovery skips them. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const row = await prisma.adCompetitor.findUnique({
    where: { id },
    include: {
      site: {
        select: {
          userSites: { where: { userId: session.user.id }, select: { id: true } },
        },
      },
    },
  });

  if (!row || row.site.userSites.length === 0) {
    return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  }

  if (row.source === "MANUAL") {
    await prisma.adCompetitor.delete({ where: { id } });
  } else {
    await prisma.adCompetitor.update({
      where: { id },
      data: { dismissed: true },
    });
  }

  return NextResponse.json({ ok: true });
}
