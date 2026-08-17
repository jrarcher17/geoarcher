import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSeoAccess } from "@/lib/seo/api-guard";
import { getTemporalClient, temporalConfigured } from "@/temporal/client";
import { AUTOPILOT_TASK_QUEUE, autopilotWorkflowId } from "@/temporal/shared";

interface WorkflowStatus {
  running: boolean;
  paused: boolean;
  currentStep: string | null;
  nextRunAt: string | null;
}

async function describeWorkflow(siteId: string): Promise<WorkflowStatus> {
  const fallback: WorkflowStatus = {
    running: false,
    paused: false,
    currentStep: null,
    nextRunAt: null,
  };
  if (!temporalConfigured()) return fallback;
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(autopilotWorkflowId(siteId));
    const description = await handle.describe();
    if (description.status.name !== "RUNNING") return fallback;
    const status = await handle.query<{
      paused: boolean;
      currentStep: string;
      nextRunAt: string | null;
    }>("status");
    return {
      running: true,
      paused: status.paused,
      currentStep: status.currentStep,
      nextRunAt: status.nextRunAt,
    };
  } catch {
    return fallback;
  }
}

/** Autopilot state: toggle, live workflow status, recent run history. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { autopilotEnabled: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const runs = await prisma.autopilotRun.findMany({
    where: { siteId },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    configured: temporalConfigured(),
    enabled: site.autopilotEnabled,
    workflow: await describeWorkflow(siteId),
    runs: runs.map((r) => ({
      id: r.id,
      status: r.status,
      steps: r.steps ?? [],
      changes: r.changes ?? null,
      error: r.error,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
  });
}

/** Turn Autopilot on (starts the workflow) or off (cancels it). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await requireSeoAccess(siteId);
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json(
      { error: "Provide enabled: true or false." },
      { status: 400 }
    );
  }

  if (body.enabled && !temporalConfigured()) {
    return NextResponse.json(
      {
        error:
          "Autopilot needs Temporal configured. Set TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE and TEMPORAL_API_KEY (or run a local dev server).",
      },
      { status: 503 }
    );
  }

  await prisma.site.update({
    where: { id: siteId },
    data: { autopilotEnabled: body.enabled },
  });

  const client = await getTemporalClient().catch(() => null);
  const workflowId = autopilotWorkflowId(siteId);

  if (body.enabled) {
    if (!client) {
      await prisma.site.update({
        where: { id: siteId },
        data: { autopilotEnabled: false },
      });
      return NextResponse.json(
        { error: "Could not reach the Temporal service." },
        { status: 502 }
      );
    }
    try {
      await client.workflow.start("siteAutopilotWorkflow", {
        workflowId,
        taskQueue: AUTOPILOT_TASK_QUEUE,
        args: [{ siteId }],
      });
    } catch (err) {
      // Already running: fine, the loop picks up the enabled flag.
      const alreadyStarted =
        err instanceof Error && err.name === "WorkflowExecutionAlreadyStartedError";
      if (!alreadyStarted) {
        await prisma.site.update({
          where: { id: siteId },
          data: { autopilotEnabled: false },
        });
        console.error("[autopilot] start failed:", err);
        return NextResponse.json(
          { error: "Could not start the Autopilot workflow." },
          { status: 502 }
        );
      }
    }
  } else if (client) {
    try {
      await client.workflow.getHandle(workflowId).cancel();
    } catch {
      // Not running — nothing to cancel.
    }
  }

  return NextResponse.json({ enabled: body.enabled });
}
