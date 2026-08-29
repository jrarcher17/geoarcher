ALTER TABLE "AdCampaign" ADD COLUMN "familyId" TEXT;

CREATE INDEX "AdCampaign_userId_familyId_idx" ON "AdCampaign"("userId", "familyId");
