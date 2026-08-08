import type { PgBoss, Job } from "pg-boss";

import { prisma } from "@/shared/database/prisma";

export const RETURN_DUE_JOB = "return-due";

/**
 * Retorno programado: avisa o cliente que já é hora de voltar.
 *
 * Elegível quem teve um atendimento CONCLUÍDO cujo serviço tem `returnIntervalDays`
 * configurado, cuja data + intervalo cai HOJE no fuso do tenant, e que **não** tem
 * agendamento futuro.
 *
 * O filtro de consentimento NÃO entra aqui: a guarda do `customerMessageDispatcher`
 * já aplica consentimento, opt-out e anti-fadiga para eventos promocionais. Repetir
 * o filtro no SQL recria exatamente o problema que a Etapa 1 resolveu.
 */
export async function handleReturnDue(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const elegiveis = await prisma.$queryRaw<
    {
      customerId: string;
      tenantId: string;
      customerName: string;
      phone: string;
      serviceName: string;
      daysSinceLastVisit: number;
    }[]
  >`
    SELECT DISTINCT ON (c.id)
      c.id                       AS "customerId",
      c."tenantId"               AS "tenantId",
      c.name                     AS "customerName",
      c.phone                    AS "phone",
      s.name                     AS "serviceName",
      s."returnIntervalDays"     AS "daysSinceLastVisit"
    FROM "Appointment" a
    INNER JOIN "Service"  s ON s.id = a."serviceId"
    INNER JOIN "Customer" c ON c.id = a."customerId"
    INNER JOIN "Tenant"   t ON t.id = a."tenantId"
    WHERE a.status = 'COMPLETED'
      AND s."returnIntervalDays" IS NOT NULL
      AND c.phone IS NOT NULL
      AND c."deletedAt" IS NULL
      AND t."evolutionConnected" = true
      -- "Hoje" no fuso do tenant, nunca no fuso do processo. startsAt é timestamp
      -- naive gravado como UTC — a primeira conversão o interpreta como UTC, a
      -- segunda devolve o horário local. NOW() já é timestamptz (instante
      -- absoluto): aplicar a MESMA cadeia dupla nele deslocaria o resultado por
      -- duas vezes o offset, na direção errada — por isso leva só uma conversão.
      AND (
        (a."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE t.timezone)::date
        + (s."returnIntervalDays" * INTERVAL '1 day')
      )::date
      = (NOW() AT TIME ZONE t.timezone)::date
      -- Quem já tem horário marcado não precisa ser lembrado de voltar.
      AND NOT EXISTS (
        SELECT 1 FROM "Appointment" fut
        WHERE fut."customerId" = c.id
          AND fut."tenantId" = c."tenantId"
          AND fut."startsAt" > NOW()
          AND fut.status IN ('SCHEDULED', 'CONFIRMED')
      )
    ORDER BY c.id, a."startsAt" DESC
  `;

  if (elegiveis.length === 0) return;

  const { customerMessageDispatcher } = await import(
    "@/domains/notifications/customer-messages/customer-message-dispatcher.service"
  );

  for (const item of elegiveis) {
    try {
      await customerMessageDispatcher.dispatch({
        tenantId: item.tenantId,
        event: "return_due",
        customerId: item.customerId,
        recipient: { phone: item.phone, email: null },
        payload: {
          customerName: item.customerName,
          lastServiceName: item.serviceName,
          daysSinceLastVisit: item.daysSinceLastVisit,
        },
      });
    } catch (err) {
      // Um telefone inválido não pode impedir os demais lembretes do dia.
      console.error(
        "[return-due] Falha ao despachar",
        item.customerId,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export async function registerReturnDue(boss: PgBoss): Promise<void> {
  await boss.schedule(RETURN_DUE_JOB, "0 12 * * *", {});
  boss.work(RETURN_DUE_JOB, handleReturnDue);
}
