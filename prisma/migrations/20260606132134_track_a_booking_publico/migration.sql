-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'RANGE', 'ON_CONSULTATION');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "priceMax" DECIMAL(10,2),
ADD COLUMN     "priceMin" DECIMAL(10,2),
ADD COLUMN     "priceType" "PriceType" NOT NULL DEFAULT 'FIXED';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoReplyIntervalHours" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "autoReplyMessage" TEXT,
ADD COLUMN     "birthdayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "birthdayGiftServiceId" TEXT,
ADD COLUMN     "birthdayMessage" TEXT,
ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "dailyStatusEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dailyStatusHour" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offHoursMessage" TEXT;

-- CreateTable
CREATE TABLE "SchedulingPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paddingMinutes" INTEGER NOT NULL DEFAULT 0,
    "minAdvanceMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "allowPublicBooking" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicRateLimit" (
    "id" TEXT NOT NULL,
    "ip" TEXT,
    "phone" TEXT,
    "action" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingPolicy_tenantId_key" ON "SchedulingPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "PublicRateLimit_ip_action_windowStart_idx" ON "PublicRateLimit"("ip", "action", "windowStart");

-- CreateIndex
CREATE INDEX "PublicRateLimit_phone_action_windowStart_idx" ON "PublicRateLimit"("phone", "action", "windowStart");

-- AddForeignKey
ALTER TABLE "SchedulingPolicy" ADD CONSTRAINT "SchedulingPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
