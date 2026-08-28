import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  adIntelligenceJob,
  adsMetricsSyncJob,
  autopilotJob,
  leadCampaignJob,
  leadFollowups,
  scanPipeline,
  seoAuditJob,
} from "@/inngest/functions";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scanPipeline,
    seoAuditJob,
    leadCampaignJob,
    leadFollowups,
    autopilotJob,
    adIntelligenceJob,
    adsMetricsSyncJob,
  ],
});
