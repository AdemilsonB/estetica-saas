-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "evolutionConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "evolutionConnectedAt" TIMESTAMP(3),
ADD COLUMN     "evolutionInstanceId" TEXT,
ADD COLUMN     "evolutionPhone" TEXT,
ADD COLUMN     "evolutionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED';
