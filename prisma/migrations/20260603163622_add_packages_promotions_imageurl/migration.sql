-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "ServicePackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "PromoDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionItem" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "serviceId" TEXT,
    "packageId" TEXT,

    CONSTRAINT "PromotionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePackage_tenantId_idx" ON "ServicePackage"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePackageItem_packageId_serviceId_key" ON "ServicePackageItem"("packageId", "serviceId");

-- CreateIndex
CREATE INDEX "Promotion_tenantId_idx" ON "Promotion"("tenantId");

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionItem" ADD CONSTRAINT "PromotionItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionItem" ADD CONSTRAINT "PromotionItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionItem" ADD CONSTRAINT "PromotionItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
