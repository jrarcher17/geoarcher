-- CreateEnum
CREATE TYPE "IntelligenceStatus" AS ENUM ('RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "OfferingKind" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "OpportunityLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('GOOGLE', 'META', 'AI_CHAT');

-- CreateEnum
CREATE TYPE "AdCampaignGoal" AS ENUM ('LEADS', 'SALES', 'TRAFFIC', 'PHONE_CALLS', 'AWARENESS');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'READY', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "CreativeSource" AS ENUM ('SITE_IMAGE', 'UPLOAD', 'GENERATED', 'NONE');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "AIActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIRecommendationStatus" AS ENUM ('NEW', 'REVIEWED', 'APPLIED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Analysis" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AutopilotRun" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailSuppression" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeoConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GeoHit" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeadCampaign" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OutreachEmail" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Page" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Prospect" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "reportToken" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Scan" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SeoAudit" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SeoKeyword" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SeoLinkSuggestion" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SeoOpportunity" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SeoPageAudit" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SeoRankCheck" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SeoSearchOpportunity" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Simulation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Site" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "geoKey" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserSite" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VisibilityReport" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SiteIntelligence" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "scanId" TEXT,
    "status" "IntelligenceStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "business" JSONB,
    "marketing" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "OfferingKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" TEXT,
    "url" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteImage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "offeringId" TEXT,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "pageUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdOpportunity" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "offeringId" TEXT,
    "title" TEXT NOT NULL,
    "level" "OpportunityLevel" NOT NULL,
    "rationale" TEXT NOT NULL,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "recommendedCampaign" JSONB,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT,
    "offeringId" TEXT,
    "prospectId" TEXT,
    "platform" "AdPlatform" NOT NULL,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "goal" "AdCampaignGoal" NOT NULL,
    "landingPage" TEXT,
    "budgetDailyCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "locations" JSONB NOT NULL DEFAULT '[]',
    "audience" JSONB,
    "structure" JSONB,
    "externalId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT,
    "copy" JSONB NOT NULL,
    "destinationUrl" TEXT,
    "creativeSource" "CreativeSource" NOT NULL DEFAULT 'NONE',
    "creative" JSONB,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlatformConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "accountId" TEXT,
    "accountName" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMetric" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CampaignMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdMetric" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "platform" "AdPlatform",
    "campaignId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "status" "AIActionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "AIAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "payload" JSONB,
    "status" "AIRecommendationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteIntelligence_siteId_key" ON "SiteIntelligence"("siteId");

-- CreateIndex
CREATE INDEX "Offering_siteId_kind_idx" ON "Offering"("siteId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Offering_siteId_name_key" ON "Offering"("siteId", "name");

-- CreateIndex
CREATE INDEX "SiteImage_siteId_idx" ON "SiteImage"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteImage_siteId_url_key" ON "SiteImage"("siteId", "url");

-- CreateIndex
CREATE INDEX "AdOpportunity_siteId_level_idx" ON "AdOpportunity"("siteId", "level");

-- CreateIndex
CREATE INDEX "AdCampaign_userId_createdAt_idx" ON "AdCampaign"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdCampaign_siteId_status_idx" ON "AdCampaign"("siteId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_userId_status_idx" ON "AdCampaign"("userId", "status");

-- CreateIndex
CREATE INDEX "Ad_campaignId_idx" ON "Ad"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdPlatformConnection_userId_platform_key" ON "AdPlatformConnection"("userId", "platform");

-- CreateIndex
CREATE INDEX "CampaignMetric_campaignId_date_idx" ON "CampaignMetric"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMetric_campaignId_date_key" ON "CampaignMetric"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdMetric_adId_date_key" ON "AdMetric"("adId", "date");

-- CreateIndex
CREATE INDEX "AIAction_userId_createdAt_idx" ON "AIAction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIAction_userId_status_idx" ON "AIAction"("userId", "status");

-- CreateIndex
CREATE INDEX "AIRecommendation_userId_status_idx" ON "AIRecommendation"("userId", "status");

-- AddForeignKey
ALTER TABLE "SiteIntelligence" ADD CONSTRAINT "SiteIntelligence_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteImage" ADD CONSTRAINT "SiteImage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteImage" ADD CONSTRAINT "SiteImage_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdOpportunity" ADD CONSTRAINT "AdOpportunity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdOpportunity" ADD CONSTRAINT "AdOpportunity_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPlatformConnection" ADD CONSTRAINT "AdPlatformConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMetric" ADD CONSTRAINT "CampaignMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMetric" ADD CONSTRAINT "AdMetric_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

