-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "whatsappContactEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "googleBusinessUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "googlePlaceId" TEXT;
