-- Pro Plus tier + AI Lead Generation Machine

-- AlterEnum
ALTER TYPE "PlanTier" ADD VALUE 'PRO_PLUS';

-- CreateEnum
CREATE TYPE "LeadCampaignMode" AS ENUM ('APPROVE_FIRST', 'AUTO_SEND');

-- CreateEnum
CREATE TYPE "LeadCampaignStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETE', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('FOUND', 'ANALYZING', 'QUALIFIED', 'DISQUALIFIED', 'CONTACTED', 'REPLIED', 'BOUNCED', 'CLOSED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutreachEmailStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'BOUNCED', 'REPLIED');

-- CreateTable
CREATE TABLE "LeadCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "location" TEXT,
    "employeeMin" INTEGER,
    "employeeMax" INTEGER,
    "targetCount" INTEGER NOT NULL,
    "mode" "LeadCampaignMode" NOT NULL DEFAULT 'APPROVE_FIRST',
    "status" "LeadCampaignStatus" NOT NULL DEFAULT 'RUNNING',
    "workflowId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "apolloOrgId" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'FOUND',
    "score" INTEGER,
    "scoreBreakdown" JSONB,
    "problems" JSONB,
    "analysis" JSONB,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "contactEmail" TEXT,
    "report" JSONB,
    "reportToken" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEmail" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutreachEmailStatus" NOT NULL DEFAULT 'DRAFT',
    "followUpIndex" INTEGER NOT NULL DEFAULT 0,
    "resendId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),

    CONSTRAINT "OutreachEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadCampaign_userId_createdAt_idx" ON "LeadCampaign"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_reportToken_key" ON "Prospect"("reportToken");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_campaignId_domain_key" ON "Prospect"("campaignId", "domain");

-- CreateIndex
CREATE INDEX "Prospect_campaignId_status_idx" ON "Prospect"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Prospect_campaignId_score_idx" ON "Prospect"("campaignId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEmail_resendId_key" ON "OutreachEmail"("resendId");

-- CreateIndex
CREATE INDEX "OutreachEmail_prospectId_followUpIndex_idx" ON "OutreachEmail"("prospectId", "followUpIndex");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_email_key" ON "EmailSuppression"("email");

-- AddForeignKey
ALTER TABLE "LeadCampaign" ADD CONSTRAINT "LeadCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LeadCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
