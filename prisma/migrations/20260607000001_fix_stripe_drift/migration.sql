-- AlterTable Plan: adiciona trialDays (já existe no banco, migration para sincronizar histórico)
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "trialDays" INTEGER NOT NULL DEFAULT 14;

-- AlterTable Subscription: adiciona colunas Stripe (já existem no banco)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeSubId" TEXT;

-- CreateIndex (já existem no banco)
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubId_key" ON "Subscription"("stripeSubId");
