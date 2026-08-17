-- SEO Autopilot continuous mode (Temporal): per-site toggle + run log

-- CreateEnum
CREATE TYPE "AutopilotRunStatus" AS ENUM ('RUNNING', 'COMPLETE', 'FAILED', 'STOPPED');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN "autopilotEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AutopilotRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "status" "AutopilotRunStatus" NOT NULL DEFAULT 'RUNNING',
    "steps" JSONB,
    "changes" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AutopilotRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutopilotRun_siteId_startedAt_idx" ON "AutopilotRun"("siteId", "startedAt");

-- AddForeignKey
ALTER TABLE "AutopilotRun" ADD CONSTRAINT "AutopilotRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
