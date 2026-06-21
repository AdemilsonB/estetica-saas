-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Customer_tenantId_deletedAt_idx" ON "Customer"("tenantId", "deletedAt");
