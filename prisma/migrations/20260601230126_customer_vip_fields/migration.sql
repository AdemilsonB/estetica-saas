-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vipUpdatedAt" TIMESTAMP(3);
