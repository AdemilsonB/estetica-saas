-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "completionSnoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SchedulingPolicy" ADD COLUMN     "pendingCompletionGraceHours" INTEGER NOT NULL DEFAULT 24;

-- CreateIndex
CREATE INDEX "Appointment_tenantId_status_endsAt_idx" ON "Appointment"("tenantId", "status", "endsAt");

-- RenameIndex
ALTER INDEX "UserNotificationPreference_tenantId_userId_eventType_channel_ke" RENAME TO "UserNotificationPreference_tenantId_userId_eventType_channe_key";
