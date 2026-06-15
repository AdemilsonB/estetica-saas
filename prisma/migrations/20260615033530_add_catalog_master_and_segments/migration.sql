-- CreateEnum
CREATE TYPE "BusinessSegment" AS ENUM ('HAIR_SALON', 'BARBERSHOP', 'NAIL_DESIGN', 'AESTHETICS');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "catalogProductId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "catalogServiceId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "segments" "BusinessSegment"[] DEFAULT ARRAY[]::"BusinessSegment"[];

-- CreateTable
CREATE TABLE "CatalogServiceCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segments" "BusinessSegment"[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CatalogServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProductCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segments" "BusinessSegment"[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CatalogProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogService" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "segments" "BusinessSegment"[],
    "categoryId" TEXT,
    "suggestedDuration" INTEGER NOT NULL,
    "suggestedPrice" DECIMAL(10,2) NOT NULL,
    "priceType" "PriceType" NOT NULL DEFAULT 'FIXED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "segments" "BusinessSegment"[],
    "categoryId" TEXT,
    "suggestedPrice" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogServiceCategory_slug_key" ON "CatalogServiceCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProductCategory_slug_key" ON "CatalogProductCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogService_slug_key" ON "CatalogService"("slug");

-- CreateIndex
CREATE INDEX "CatalogService_active_idx" ON "CatalogService"("active");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_slug_key" ON "CatalogProduct"("slug");

-- CreateIndex
CREATE INDEX "CatalogProduct_active_idx" ON "CatalogProduct"("active");

-- AddForeignKey
ALTER TABLE "CatalogService" ADD CONSTRAINT "CatalogService_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
