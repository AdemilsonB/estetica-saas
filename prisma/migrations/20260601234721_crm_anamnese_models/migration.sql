-- CreateTable
CREATE TABLE "AnamneseTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "linkMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnamneseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAnamnese" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "publicToken" TEXT NOT NULL,
    "filledAt" TIMESTAMP(3),
    "filledBy" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAnamnese_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnamneseTemplate_tenantId_key" ON "AnamneseTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAnamnese_customerId_key" ON "CustomerAnamnese"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAnamnese_publicToken_key" ON "CustomerAnamnese"("publicToken");

-- CreateIndex
CREATE INDEX "CustomerAnamnese_tenantId_idx" ON "CustomerAnamnese"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerAnamnese_publicToken_idx" ON "CustomerAnamnese"("publicToken");

-- AddForeignKey
ALTER TABLE "AnamneseTemplate" ADD CONSTRAINT "AnamneseTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAnamnese" ADD CONSTRAINT "CustomerAnamnese_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAnamnese" ADD CONSTRAINT "CustomerAnamnese_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
