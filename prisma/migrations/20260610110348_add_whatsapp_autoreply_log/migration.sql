-- AlterTable
ALTER TABLE "ServiceCategory" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "WhatsAppAutoReplyLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "repliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppAutoReplyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppAutoReplyLog_tenantId_phone_repliedAt_idx" ON "WhatsAppAutoReplyLog"("tenantId", "phone", "repliedAt");

-- AddForeignKey
ALTER TABLE "WhatsAppAutoReplyLog" ADD CONSTRAINT "WhatsAppAutoReplyLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
