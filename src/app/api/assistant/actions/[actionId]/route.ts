import { NextResponse } from "next/server";
import { requireAdAccess } from "@/lib/advertising/api-guard";
import { executeApprovedAction, rejectAction } from "@/lib/advertising/execute-action";

export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> }
) {
  const { actionId } = await params;
  const access = await requireAdAccess();
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const decision = body?.decision === "reject" ? "reject" : "approve";

  try {
    const row =
      decision === "reject"
        ? await rejectAction(access.userId, actionId)
        : await executeApprovedAction(access.userId, actionId);
    return NextResponse.json({
      action: {
        id: row.id,
        status: row.status,
        error: row.error,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update the action." },
      { status: 409 }
    );
  }
}
