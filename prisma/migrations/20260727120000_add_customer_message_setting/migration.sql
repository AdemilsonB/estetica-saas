-- CreateEnum
CREATE TYPE "AppointmentOrigin" AS ENUM ('PANEL', 'PUBLIC');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "origin" "AppointmentOrigin" NOT NULL DEFAULT 'PANEL';

-- CreateTable
CREATE TABLE "CustomerMessageSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "event" "CustomerMessageEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" "NotificationChannel"[] DEFAULT ARRAY['WHATSAPP']::"NotificationChannel"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMessageSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerMessageSetting_tenantId_idx" ON "CustomerMessageSetting"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMessageSetting_tenantId_event_key" ON "CustomerMessageSetting"("tenantId", "event");

-- AddForeignKey
ALTER TABLE "CustomerMessageSetting" ADD CONSTRAINT "CustomerMessageSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
