-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "zipCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "phone" TEXT;
