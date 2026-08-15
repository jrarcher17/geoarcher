-- SEO Autopilot Phase 3: DataForSEO rank tracking

-- CreateTable
CREATE TABLE "SeoKeyword" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL DEFAULT 2840,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoRankCheck" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "position" INTEGER,
    "url" TEXT,
    "topResults" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoRankCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeyword_siteId_keyword_key" ON "SeoKeyword"("siteId", "keyword");

-- CreateIndex
CREATE INDEX "SeoRankCheck_keywordId_checkedAt_idx" ON "SeoRankCheck"("keywordId", "checkedAt");

-- AddForeignKey
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoRankCheck" ADD CONSTRAINT "SeoRankCheck_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
