-- AlterTable
ALTER TABLE "user" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "user" ADD COLUMN "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_stripeCustomerId_key" ON "user"("stripeCustomerId");
CREATE UNIQUE INDEX "user_stripeSubscriptionId_key" ON "user"("stripeSubscriptionId");
