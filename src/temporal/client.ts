import { Client, Connection } from "@temporalio/client";

/**
 * Lazy Temporal client for Next.js API routes. Configured entirely by env:
 * without TEMPORAL_* vars set it connects to a local dev server
 * (`temporal server start-dev`); with them it connects to Temporal Cloud.
 */

let clientPromise: Promise<Client> | null = null;

export function temporalConfigured(): boolean {
  // Local default counts as configured in development; production requires
  // an explicit address so we can show a setup notice instead of failing.
  return (
    Boolean(process.env.TEMPORAL_ADDRESS) ||
    process.env.NODE_ENV === "development"
  );
}

export function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
      const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
      const apiKey = process.env.TEMPORAL_API_KEY;
      const connection = await Connection.connect({
        address,
        ...(apiKey ? { tls: true, apiKey } : {}),
      });
      return new Client({ connection, namespace });
    })();
    // Allow a retry on the next request if the first connection fails.
    clientPromise.catch(() => {
      clientPromise = null;
    });
  }
  return clientPromise;
}
