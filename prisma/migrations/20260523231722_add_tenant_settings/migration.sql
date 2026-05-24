-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "zApiInstanceId" TEXT,
ADD COLUMN     "zApiToken" TEXT;
