-- ============================================================================
-- Aplicação MANUAL da migration da avaliação (#284) via Supabase SQL Editor
-- ----------------------------------------------------------------------------
-- Use este arquivo quando `prisma migrate deploy` não conecta no banco (ex.: a
-- rede local bloqueia a porta 5432). Roda o SQL da migration E registra ela na
-- tabela de controle do Prisma (_prisma_migrations), para que um
-- `prisma migrate deploy` futuro NÃO tente recriar a tabela.
--
-- Rode o BLOCO INTEIRO de uma vez no Supabase SQL Editor. É transacional:
-- ou aplica tudo, ou nada.
-- ============================================================================

BEGIN;

-- 1) Tabela da avaliação (idêntico ao migration.sql de 20260720120000)
CREATE TABLE "AppointmentReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "routedToGoogle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentReview_appointmentId_key" ON "AppointmentReview"("appointmentId");
CREATE INDEX "AppointmentReview_tenantId_idx" ON "AppointmentReview"("tenantId");
CREATE INDEX "AppointmentReview_tenantId_createdAt_idx" ON "AppointmentReview"("tenantId", "createdAt");
CREATE INDEX "AppointmentReview_customerId_idx" ON "AppointmentReview"("customerId");

ALTER TABLE "AppointmentReview" ADD CONSTRAINT "AppointmentReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentReview" ADD CONSTRAINT "AppointmentReview_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentReview" ADD CONSTRAINT "AppointmentReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Marca a migration como aplicada (checksum real do migration.sql)
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
  (gen_random_uuid()::text,
   'b8a7047219289d8c80300a8d657e878a6024c07b9383937a5289747c03e744ca',
   now(), '20260720120000_add_appointment_review', NULL, NULL, now(), 1);

COMMIT;

-- Verificação (opcional): deve retornar 1 linha com a migration registrada.
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE migration_name = '20260720120000_add_appointment_review';
