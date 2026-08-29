-- CreateEnum
CREATE TYPE "LibraryAdContext" AS ENUM ('SITE', 'OFFERING', 'COMPETITOR');

-- CreateTable
CREATE TABLE "LibraryAd" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "offeringId" TEXT,
    "competitorId" TEXT,
    "contextType" "LibraryAdContext" NOT NULL,
    "contextId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "advertiserName" TEXT,
    "headline" TEXT,
    "primaryText" TEXT,
    "cta" TEXT,
    "landingPage" TEXT,
    "creativeUrl" TEXT,
    "format" TEXT,
    "firstSeen" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "publisherPlatforms" JSONB NOT NULL DEFAULT '[]',
    "searchTerms" TEXT NOT NULL,
    "countries" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibrarySearch" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "contextType" "LibraryAdContext" NOT NULL,
    "contextId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "countries" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibrarySearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryAd_siteId_provider_externalId_contextType_contextId_key" ON "LibraryAd"("siteId", "provider", "externalId", "contextType", "contextId");

-- CreateIndex
CREATE INDEX "LibraryAd_siteId_fetchedAt_idx" ON "LibraryAd"("siteId", "fetchedAt");

-- CreateIndex
CREATE INDEX "LibraryAd_contextType_contextId_idx" ON "LibraryAd"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "LibrarySearch_siteId_contextType_contextId_createdAt_idx" ON "LibrarySearch"("siteId", "contextType", "contextId", "createdAt");

-- AddForeignKey
ALTER TABLE "LibraryAd" ADD CONSTRAINT "LibraryAd_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryAd" ADD CONSTRAINT "LibraryAd_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryAd" ADD CONSTRAINT "LibraryAd_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "AdCompetitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibrarySearch" ADD CONSTRAINT "LibrarySearch_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
