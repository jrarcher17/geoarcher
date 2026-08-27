import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inngestConfigured } from "@/inngest/client";
import { startAutopilot } from "@/lib/jobs/start";
import { requireSeoAccess } from "@/lib/seo/api-guard";

interface WorkflowStatus {
  running: boolean;
  paused: boolean;
  currentStep: string | null;
  nextRunAt: string | null;
}

function describeFromRuns(
  enabled: boolean,
  runs: {
    status: string;
    finishedAt: Date | null;
    steps: unknown;
  }[]
): WorkflowStatus {
  if (!enabled) {
    return { running: false, paused: false, currentStep: null, nextRunAt: null };
  }

  const intervalDays = Number(process.env.AUTOPILOT_INTERVAL_DAYS ?? 7);
  const intervalMs = Math.max(1, intervalDays) * 24 * 60 * 60 * 1000;
  const latest = runs[0];

  if (latest?.status === "RUNNING") {
    const steps = Array.isArray(latest.steps) ? latest.steps : [];
    const last = steps[steps.length - 1] as { step?: string } | undefined;
    return {
      running: true,
      paused: false,
      currentStep: last?.step ?? "running",
      nextRunAt: null,
    };
  }

  const lastFinished =
    runs.find((r) => r.finishedAt)?.finishedAt ?? latest?.finishedAt ?? null;
  return {
    running: true,
    paused: false,
    currentStep: "sleeping",
    nextRunAt: lastFinished
      ? new Date(lastFinished.getTime() + intervalMs).toISOString()
      : new Date().toISOString(),
  };
}

/** Autopilot state: toggle, latest run status, recent history. */
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
    configured: inngestConfigured(),
    enabled: site.autopilotEnabled,
    workflow: describeFromRuns(site.autopilotEnabled, runs),
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

/** Turn Autopilot on (queues the first cycle) or off (stops after the current one). */
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

  if (body.enabled && !inngestConfigured()) {
    return NextResponse.json(
      {
        error:
          "Autopilot needs Inngest. Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY, then sync https://your-host/api/inngest in the Inngest dashboard.",
      },
      { status: 503 }
    );
  }

  await prisma.site.update({
    where: { id: siteId },
    data: { autopilotEnabled: body.enabled },
  });

  if (body.enabled) {
    try {
      await startAutopilot(siteId, { force: true });
    } catch (err) {
      await prisma.site.update({
        where: { id: siteId },
        data: { autopilotEnabled: false },
      });
      console.error("[autopilot] start failed:", err);
      return NextResponse.json(
        { error: "Could not queue the Autopilot job." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ enabled: body.enabled });
}
