/*
  Warnings:

  - Added the required column `updatedAt` to the `CatalogProductCategory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CatalogServiceCategory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CatalogProductCategory" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CatalogServiceCategory" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "CatalogProductCategory_active_idx" ON "CatalogProductCategory"("active");

-- CreateIndex
CREATE INDEX "CatalogServiceCategory_active_idx" ON "CatalogServiceCategory"("active");

-- CreateIndex
CREATE INDEX "Product_catalogProductId_idx" ON "Product"("catalogProductId");

-- CreateIndex
CREATE INDEX "Service_catalogServiceId_idx" ON "Service"("catalogServiceId");
