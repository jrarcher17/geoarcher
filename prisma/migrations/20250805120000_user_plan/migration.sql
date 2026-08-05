-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "plan" "PlanTier" NOT NULL DEFAULT 'FREE';
