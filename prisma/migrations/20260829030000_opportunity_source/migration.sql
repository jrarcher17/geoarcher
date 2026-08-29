-- CreateEnum
CREATE TYPE "AdOpportunitySource" AS ENUM ('SITE', 'COMPETITOR_GAP');

-- AlterTable
ALTER TABLE "AdOpportunity" ADD COLUMN "source" "AdOpportunitySource" NOT NULL DEFAULT 'SITE';
ALTER TABLE "AdOpportunity" ADD COLUMN "details" JSONB;

-- CreateIndex
CREATE INDEX "AdOpportunity_siteId_source_idx" ON "AdOpportunity"("siteId", "source");
