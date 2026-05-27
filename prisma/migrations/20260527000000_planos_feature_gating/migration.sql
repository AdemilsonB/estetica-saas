BEGIN;

-- Migration: planos-feature-gating
-- Adiciona enums PlanName e SubscriptionStatus, converte coluna Tenant.plan
-- e cria tabelas Subscription e SubscriptionHistory.
--
-- ATENÇÃO: O Prisma gera DROP + ADD COLUMN para mudanças de tipo.
-- A estratégia aqui é:
--   1. Criar os enums
--   2. Validar valores existentes antes de qualquer alteração destrutiva
--   3. Criar coluna temporária para preservar os dados
--   4. Copiar e converter os valores para uppercase (com COALESCE para NULLs)
--   5. Dropar a coluna original
--   6. Adicionar a coluna com o tipo enum correto
--   7. Restaurar os dados da coluna temporária
--   8. Dropar a coluna temporária

-- CreateEnum
CREATE TYPE "PlanName" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- Valida valores antes de dropar a coluna original (aborta se houver valor inválido)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Tenant"
    WHERE UPPER(COALESCE(plan, '')) NOT IN ('FREE', 'STARTER', 'PRO', 'ENTERPRISE')
  ) THEN
    RAISE EXCEPTION 'Valores inválidos em Tenant.plan detectados antes da migration. Corrija manualmente: %',
      (SELECT STRING_AGG(DISTINCT COALESCE(plan, 'NULL'), ', ') FROM "Tenant"
       WHERE UPPER(COALESCE(plan, '')) NOT IN ('FREE', 'STARTER', 'PRO', 'ENTERPRISE'));
  END IF;
END $$;

-- Salva os valores atuais em coluna temporária antes de dropar
-- COALESCE garante que NULLs recebam valor padrão 'FREE' em vez de falhar no cast
ALTER TABLE "Tenant" ADD COLUMN "plan_backup" TEXT;
UPDATE "Tenant" SET "plan_backup" = COALESCE(UPPER(plan), 'FREE');

-- AlterTable: remove coluna antiga (tipo TEXT) e adiciona com tipo enum
ALTER TABLE "Tenant" DROP COLUMN "plan";
ALTER TABLE "Tenant" ADD COLUMN "plan" "PlanName" NOT NULL DEFAULT 'FREE';

-- Restaura os dados convertidos para uppercase
UPDATE "Tenant" SET "plan" = "plan_backup"::"PlanName";

-- Remove coluna temporária
ALTER TABLE "Tenant" DROP COLUMN "plan_backup";

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "PlanName" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromPlan" "PlanName",
    "toPlan" "PlanName" NOT NULL,
    "fromStatus" "SubscriptionStatus",
    "toStatus" "SubscriptionStatus" NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_subscriptionId_idx" ON "SubscriptionHistory"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
