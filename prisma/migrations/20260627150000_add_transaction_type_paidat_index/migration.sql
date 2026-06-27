-- CreateIndex
CREATE INDEX "Transaction_tenantId_type_paidAt_idx" ON "Transaction"("tenantId", "type", "paidAt");
