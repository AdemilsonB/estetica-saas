-- CreateEnum
CREATE TYPE "AnamneseMode" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

-- DropForeignKey
ALTER TABLE "AnamneseTemplate" DROP CONSTRAINT "AnamneseTemplate_tenantId_fkey";

-- DropIndex
DROP INDEX "CustomerAnamnese_publicToken_idx";

-- DropIndex
DROP INDEX "CustomerAnamnese_publicToken_key";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "anamneseId" TEXT;

-- AlterTable
ALTER TABLE "CustomerAnamnese" DROP COLUMN "data",
DROP COLUMN "filledAt",
DROP COLUMN "filledBy",
DROP COLUMN "publicToken",
ADD COLUMN     "blockTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "blocks" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "anamneseBlocks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "anamneseMode" "AnamneseMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "anamneseValidityDays" INTEGER NOT NULL DEFAULT 90;

-- DropTable
DROP TABLE "AnamneseTemplate";

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_anamneseId_fkey" FOREIGN KEY ("anamneseId") REFERENCES "CustomerAnamnese"("id") ON DELETE SET NULL ON UPDATE CASCADE;
