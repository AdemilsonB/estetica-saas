-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "birthDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "reminderLeadHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "reminderWindowEnd" INTEGER NOT NULL DEFAULT 22,
ADD COLUMN     "reminderWindowStart" INTEGER NOT NULL DEFAULT 7;
