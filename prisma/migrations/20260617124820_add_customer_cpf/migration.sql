-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "cpf" TEXT;

-- CreateIndex
CREATE INDEX "Customer_tenantId_cpf_idx" ON "Customer"("tenantId", "cpf");
