-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "allowOverlap" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "businessHours" JSONB;
