-- CreateEnum
CREATE TYPE "AppointmentPaymentStatus" AS ENUM ('PENDING', 'PAID', 'COURTESY', 'DEBT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER');

-- CreateEnum
CREATE TYPE "DiscountApplyType" AS ENUM ('PERCENTAGE', 'FIXED_VALUE');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('MONTHLY', 'WEEKLY');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "discountTypeId" TEXT,
ADD COLUMN     "discountValue" DECIMAL(10,2),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentStatus" "AppointmentPaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "cardFeeConfig" JSONB;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "cardFeeAmount" DECIMAL(10,2),
ADD COLUMN     "commissionAmount" DECIMAL(10,2),
ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "grossAmount" DECIMAL(10,2),
ADD COLUMN     "netAmount" DECIMAL(10,2),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "professionalId" TEXT,
ADD COLUMN     "tipAmount" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "DiscountType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountApplyType" NOT NULL,
    "defaultValue" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCommission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "recurrenceType" "RecurrenceType" NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountType_tenantId_idx" ON "DiscountType"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceCommission_tenantId_idx" ON "ServiceCommission"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCommission_tenantId_serviceId_professionalId_key" ON "ServiceCommission"("tenantId", "serviceId", "professionalId");

-- CreateIndex
CREATE INDEX "RecurringExpense_tenantId_idx" ON "RecurringExpense"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringExpense_tenantId_nextDueDate_idx" ON "RecurringExpense"("tenantId", "nextDueDate");

-- AddForeignKey
ALTER TABLE "DiscountType" ADD CONSTRAINT "DiscountType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
