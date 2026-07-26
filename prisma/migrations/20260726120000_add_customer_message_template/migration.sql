-- CreateEnum
CREATE TYPE "CustomerMessageEvent" AS ENUM ('appointment_requested', 'appointment_created', 'appointment_confirmed', 'appointment_rescheduled', 'appointment_cancelled', 'appointment_no_show', 'appointment_reminder', 'birthday', 'return_due', 'winback');

-- CreateTable
CREATE TABLE "CustomerMessageTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "event" "CustomerMessageEvent" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerMessageTemplate_tenantId_idx" ON "CustomerMessageTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMessageTemplate_tenantId_event_channel_key" ON "CustomerMessageTemplate"("tenantId", "event", "channel");

-- AddForeignKey
ALTER TABLE "CustomerMessageTemplate" ADD CONSTRAINT "CustomerMessageTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
