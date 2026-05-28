-- Migration: add_branding_config_model
-- Remove coluna brandingConfig (JSONB) do Tenant e cria model relacional BrandingConfig

-- AlterTable: remove coluna JSONB
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "brandingConfig";

-- CreateTable
CREATE TABLE "BrandingConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#191919',
    "secondaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "accentColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f8f8f7',
    "fontFamily" TEXT NOT NULL DEFAULT 'inter',
    "borderRadius" TEXT NOT NULL DEFAULT 'medium',
    "colorScheme" TEXT NOT NULL DEFAULT 'light',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandingConfig_tenantId_key" ON "BrandingConfig"("tenantId");

-- CreateIndex
CREATE INDEX "BrandingConfig_tenantId_idx" ON "BrandingConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "BrandingConfig" ADD CONSTRAINT "BrandingConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
