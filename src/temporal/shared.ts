/** Constants shared by the worker, workflows and the Next.js client. */

export const AUTOPILOT_TASK_QUEUE =
  process.env.TEMPORAL_TASK_QUEUE ?? "geo-archer";

export function autopilotWorkflowId(siteId: string): string {
  return `seo-autopilot-${siteId}`;
}
