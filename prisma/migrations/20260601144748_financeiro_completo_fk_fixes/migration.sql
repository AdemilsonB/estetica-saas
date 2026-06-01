-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_discountTypeId_fkey" FOREIGN KEY ("discountTypeId") REFERENCES "DiscountType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCommission" ADD CONSTRAINT "ServiceCommission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
