import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "geoarcher" });

/** Cloudoku / production needs INNGEST_EVENT_KEY. Local dev uses the Inngest CLI. */
export function inngestConfigured(): boolean {
  return Boolean(
    process.env.INNGEST_EVENT_KEY?.trim() ||
      process.env.NODE_ENV !== "production"
  );
}
