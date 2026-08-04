-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('RUNNING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Simulation_scanId_key" ON "Simulation"("scanId");

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
