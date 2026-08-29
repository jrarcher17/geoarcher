CREATE TABLE "StrategyRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "monthlyAdBudgetCents" INTEGER,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StrategyRequest_email_createdAt_idx" ON "StrategyRequest"("email", "createdAt");
CREATE INDEX "StrategyRequest_userId_createdAt_idx" ON "StrategyRequest"("userId", "createdAt");

ALTER TABLE "StrategyRequest" ADD CONSTRAINT "StrategyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
