-- CreateTable
CREATE TABLE "VisibilityReport" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "VisibilityReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityReport_scanId_key" ON "VisibilityReport"("scanId");

-- AddForeignKey
ALTER TABLE "VisibilityReport" ADD CONSTRAINT "VisibilityReport_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
