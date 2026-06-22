-- CreateIndex
CREATE INDEX "Appointment_tenantId_customerId_idx" ON "Appointment"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_status_idx" ON "Appointment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");

-- CreateIndex
CREATE INDEX "Appointment_createdByUserId_idx" ON "Appointment"("createdByUserId");

-- CreateIndex
CREATE INDEX "Appointment_discountTypeId_idx" ON "Appointment"("discountTypeId");

-- CreateIndex
CREATE INDEX "AppointmentProduct_productId_idx" ON "AppointmentProduct"("productId");

-- CreateIndex
CREATE INDEX "CatalogProduct_categoryId_idx" ON "CatalogProduct"("categoryId");

-- CreateIndex
CREATE INDEX "CatalogService_categoryId_idx" ON "CatalogService"("categoryId");

-- CreateIndex
CREATE INDEX "NotificationLog_appointmentId_idx" ON "NotificationLog"("appointmentId");

-- CreateIndex
CREATE INDEX "NotificationLog_customerId_idx" ON "NotificationLog"("customerId");

-- CreateIndex
CREATE INDEX "PromotionItem_promotionId_idx" ON "PromotionItem"("promotionId");

-- CreateIndex
CREATE INDEX "PromotionItem_serviceId_idx" ON "PromotionItem"("serviceId");

-- CreateIndex
CREATE INDEX "PromotionItem_packageId_idx" ON "PromotionItem"("packageId");

-- CreateIndex
CREATE INDEX "ServicePackageItem_serviceId_idx" ON "ServicePackageItem"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceProduct_productId_idx" ON "ServiceProduct"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_appointmentId_idx" ON "StockMovement"("appointmentId");

-- CreateIndex
CREATE INDEX "StockMovement_createdByUserId_idx" ON "StockMovement"("createdByUserId");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_professionalId_idx" ON "Transaction"("tenantId", "professionalId");

-- CreateIndex
CREATE INDEX "Transaction_appointmentId_idx" ON "Transaction"("appointmentId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
