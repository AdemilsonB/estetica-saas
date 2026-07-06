-- CreateTable
CREATE TABLE "CapabilityInterestLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapabilityInterestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapabilityInterestLog_tenantId_idx" ON "CapabilityInterestLog"("tenantId");

-- CreateIndex
CREATE INDEX "CapabilityInterestLog_capabilityKey_idx" ON "CapabilityInterestLog"("capabilityKey");
