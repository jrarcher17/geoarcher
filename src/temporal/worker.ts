import path from "node:path";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import * as leadActivities from "./lead-activities";
import { AUTOPILOT_TASK_QUEUE } from "./shared";

/**
 * SEO Autopilot worker — a long-running Node process (run locally with
 * `pnpm worker`, or deploy the same command to your host).
 *
 * Local dev:      `temporal server start-dev` + no TEMPORAL_* env needed.
 * Temporal Cloud: set TEMPORAL_ADDRESS (e.g. us-east-1.aws.api.temporal.io:7233),
 *                 TEMPORAL_NAMESPACE (e.g. yourns.acctid) and TEMPORAL_API_KEY.
 */
async function main() {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
  const apiKey = process.env.TEMPORAL_API_KEY;

  const connection = await NativeConnection.connect({
    address,
    ...(apiKey ? { tls: true, apiKey } : {}),
  });

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue: AUTOPILOT_TASK_QUEUE,
    workflowsPath: path.join(__dirname, "workflows.ts"),
    activities: { ...activities, ...leadActivities },
    // Crawls are heavy (Browserless sessions); keep concurrency conservative.
    maxConcurrentActivityTaskExecutions: 6,
  });

  console.log(
    `[worker] GEO Archer worker started (namespace=${namespace}, taskQueue=${AUTOPILOT_TASK_QUEUE}, address=${address})`
  );
  await worker.run();
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
