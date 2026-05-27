-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateTable
CREATE TABLE "TenantInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantInvite_tenantId_idx" ON "TenantInvite"("tenantId");

-- CreateIndex
CREATE INDEX "TenantInvite_email_status_idx" ON "TenantInvite"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvite_tenantId_email_key" ON "TenantInvite"("tenantId", "email");

-- AddForeignKey
ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
