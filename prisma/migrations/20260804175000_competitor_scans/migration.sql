-- AlterTable
ALTER TABLE "Scan" ADD COLUMN "benchmarkScanId" TEXT;

-- CreateIndex
CREATE INDEX "Scan_benchmarkScanId_idx" ON "Scan"("benchmarkScanId");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_benchmarkScanId_fkey" FOREIGN KEY ("benchmarkScanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
