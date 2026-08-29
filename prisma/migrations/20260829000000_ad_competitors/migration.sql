-- CreateEnum
CREATE TYPE "CompetitorSource" AS ENUM ('MENTIONED', 'AI_RECOMMENDATION', 'MANUAL');

-- CreateTable
CREATE TABLE "AdCompetitor" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "offeringId" TEXT,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "category" TEXT,
    "rationale" TEXT NOT NULL,
    "details" JSONB,
    "source" "CompetitorSource" NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdCompetitor_siteId_name_key" ON "AdCompetitor"("siteId", "name");

-- CreateIndex
CREATE INDEX "AdCompetitor_siteId_source_idx" ON "AdCompetitor"("siteId", "source");

-- AddForeignKey
ALTER TABLE "AdCompetitor" ADD CONSTRAINT "AdCompetitor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCompetitor" ADD CONSTRAINT "AdCompetitor_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
