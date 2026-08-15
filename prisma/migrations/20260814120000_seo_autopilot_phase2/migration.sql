-- SEO Autopilot Phase 2: content plan, internal link suggestions, search opportunities

-- AlterTable
ALTER TABLE "SeoAudit" ADD COLUMN "contentPlan" JSONB;

-- CreateTable
CREATE TABLE "SeoLinkSuggestion" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "auditId" TEXT,
    "fromUrl" TEXT NOT NULL,
    "toUrl" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SeoOpportunityStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoLinkSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSearchOpportunity" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "auditId" TEXT,
    "keyword" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "demand" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "existingUrl" TEXT,
    "recommendedUrl" TEXT NOT NULL,
    "contentType" TEXT,
    "opportunityScore" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SeoOpportunityStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSearchOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoLinkSuggestion_siteId_fromUrl_toUrl_key" ON "SeoLinkSuggestion"("siteId", "fromUrl", "toUrl");

-- CreateIndex
CREATE INDEX "SeoLinkSuggestion_siteId_status_idx" ON "SeoLinkSuggestion"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SeoSearchOpportunity_siteId_keyword_key" ON "SeoSearchOpportunity"("siteId", "keyword");

-- CreateIndex
CREATE INDEX "SeoSearchOpportunity_siteId_opportunityScore_idx" ON "SeoSearchOpportunity"("siteId", "opportunityScore");

-- AddForeignKey
ALTER TABLE "SeoLinkSuggestion" ADD CONSTRAINT "SeoLinkSuggestion_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSearchOpportunity" ADD CONSTRAINT "SeoSearchOpportunity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
