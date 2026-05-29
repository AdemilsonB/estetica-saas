/*
  Warnings:

  - You are about to drop the column `zApiInstanceId` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `zApiToken` on the `Tenant` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "consentDate" TIMESTAMP(3),
ADD COLUMN     "consentGiven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentOrigin" TEXT;

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "zApiInstanceId",
DROP COLUMN "zApiToken",
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
ADD COLUMN     "whatsappTemplateConfig" JSONB;

-- CreateTable
CREATE TABLE "WhatsAppMonthlyUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMonthlyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppMonthlyUsage_tenantId_idx" ON "WhatsAppMonthlyUsage"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMonthlyUsage_tenantId_year_month_key" ON "WhatsAppMonthlyUsage"("tenantId", "year", "month");
