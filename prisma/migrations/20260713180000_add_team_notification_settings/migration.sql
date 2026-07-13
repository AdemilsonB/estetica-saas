-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('appointment_created', 'appointment_cancelled', 'appointment_rescheduled', 'appointment_no_show', 'customer_created', 'appointment_pending_confirmation', 'payment_pending', 'daily_digest', 'birthday_digest', 'customer_inactive', 'agenda_idle', 'monthly_goal');

-- CreateEnum
CREATE TYPE "TeamNotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationDeliveryMode" TEXT NOT NULL DEFAULT 'realtime',
ADD COLUMN     "quietHoursStart" INTEGER,
ADD COLUMN     "quietHoursEnd" INTEGER;

-- CreateTable
CREATE TABLE "TenantNotificationSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultChannels" "TeamNotificationChannel"[] DEFAULT ARRAY['IN_APP', 'EMAIL']::"TeamNotificationChannel"[],
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantNotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "channel" "TeamNotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "channel" "TeamNotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantNotificationSetting_tenantId_idx" ON "TenantNotificationSetting"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantNotificationSetting_tenantId_eventType_key" ON "TenantNotificationSetting"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "UserNotificationPreference_tenantId_userId_idx" ON "UserNotificationPreference"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPreference_tenantId_userId_eventType_channel_key" ON "UserNotificationPreference"("tenantId", "userId", "eventType", "channel");

-- CreateIndex
CREATE INDEX "NotificationTemplate_tenantId_idx" ON "NotificationTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_tenantId_eventType_channel_key" ON "NotificationTemplate"("tenantId", "eventType", "channel");

-- AddForeignKey
ALTER TABLE "TenantNotificationSetting" ADD CONSTRAINT "TenantNotificationSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantNotificationSetting" ADD CONSTRAINT "TenantNotificationSetting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
