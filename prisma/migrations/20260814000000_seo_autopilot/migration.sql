-- SEO Autopilot: audits derived from existing Scan pages (no second crawl)

-- CreateEnum
CREATE TYPE "SeoAuditStatus" AS ENUM ('RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "SeoOpportunityStatus" AS ENUM ('NEW', 'REVIEWED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateTable
CREATE TABLE "SeoAudit" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "status" "SeoAuditStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "overallScore" INTEGER,
    "categoryScores" JSONB,
    "siteChecks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SeoAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoPageAudit" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "pageId" TEXT,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "issues" JSONB NOT NULL,
    "facts" JSONB NOT NULL,

    CONSTRAINT "SeoPageAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoOpportunity" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "auditId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "observed" TEXT NOT NULL,
    "inferred" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "contentType" TEXT,
    "affectedPages" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
    "status" "SeoOpportunityStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoAudit_scanId_key" ON "SeoAudit"("scanId");

-- CreateIndex
CREATE INDEX "SeoAudit_siteId_createdAt_idx" ON "SeoAudit"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoPageAudit_auditId_idx" ON "SeoPageAudit"("auditId");

-- CreateIndex
CREATE INDEX "SeoPageAudit_auditId_score_idx" ON "SeoPageAudit"("auditId", "score");

-- CreateIndex
CREATE INDEX "SeoOpportunity_siteId_status_idx" ON "SeoOpportunity"("siteId", "status");

-- CreateIndex
CREATE INDEX "SeoOpportunity_siteId_opportunityScore_idx" ON "SeoOpportunity"("siteId", "opportunityScore");

-- AddForeignKey
ALTER TABLE "SeoAudit" ADD CONSTRAINT "SeoAudit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoAudit" ADD CONSTRAINT "SeoAudit_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoPageAudit" ADD CONSTRAINT "SeoPageAudit_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "SeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoOpportunity" ADD CONSTRAINT "SeoOpportunity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
