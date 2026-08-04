-- AlterTable: geoKey backfill for existing sites
ALTER TABLE "Site" ADD COLUMN "geoKey" TEXT;

UPDATE "Site" SET "geoKey" = md5(random()::text || id || clock_timestamp()::text) WHERE "geoKey" IS NULL;

ALTER TABLE "Site" ALTER COLUMN "geoKey" SET NOT NULL;

CREATE UNIQUE INDEX "Site_geoKey_key" ON "Site"("geoKey");

-- CreateTable
CREATE TABLE "GeoConfig" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "jsonLd" JSONB NOT NULL DEFAULT '[]',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "sourceScanId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoHit" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoConfig_siteId_key" ON "GeoConfig"("siteId");

-- CreateIndex
CREATE INDEX "GeoHit_siteId_createdAt_idx" ON "GeoHit"("siteId", "createdAt");

-- AddForeignKey
ALTER TABLE "GeoConfig" ADD CONSTRAINT "GeoConfig_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoHit" ADD CONSTRAINT "GeoHit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
