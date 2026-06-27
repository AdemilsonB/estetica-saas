-- CreateEnum
CREATE TYPE "TenantDocumentType" AS ENUM ('CPF', 'CNPJ');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "document" TEXT,
ADD COLUMN     "documentType" "TenantDocumentType";

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_document_key" ON "Tenant"("document");

