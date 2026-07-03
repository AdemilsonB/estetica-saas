import { Prisma } from '@prisma/client'

import { prisma } from '@/shared/database/prisma'
import { dayBoundsInTz, monthBoundsInTz } from '@/lib/dates'
import { featureGuard, FEATURES } from '@/domains/billing/feature-guard'

import {
  enumerateBuckets,
  granularityFor,
  percentDelta,
  pointsDelta,
  previousWindow,
  type Granularity,
} from './analytics-utils'
import type {
  OverviewReport,
  OverviewReportInput,
  SeasonalityCell,
  SeasonalityReport,
  SeasonalityReportInput,
} from './types'

type Janela = { from: Date; to: Date }

export class AnalyticsService {
  // Resolve o período e o timezone do tenant para queries conscientes de fuso.
  private async resolvePeriodTz(
    tenantId: string,
    input: { from?: string; to?: string },
  ): Promise<{ from: Date; to: Date; tz: string }> {
    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    })
    const tz = tenant.timezone ?? 'America/Sao_Paulo'
    return {
      from: input.from ? new Date(input.from) : monthBoundsInTz(tz).start,
      to: input.to ? new Date(input.to) : dayBoundsInTz(tz).end,
      tz,
    }
  }

  private categoryJoin(categoryId?: string): Prisma.Sql {
    return categoryId
      ? Prisma.sql`
          JOIN "Appointment" ap ON ap.id = t."appointmentId"
          JOIN "Service" s ON s.id = ap."serviceId" AND s."categoryId" = ${categoryId}`
      : Prisma.empty
  }

  private async revenueKpis(
    tenantId: string,
    janela: Janela,
    categoryId?: string,
  ): Promise<{ receita: number; pagos: number }> {
    const rows = await prisma.$queryRaw<{ receita: number; pagos: number }[]>`
      SELECT
        COALESCE(SUM(COALESCE(t."netAmount", t.amount)), 0)::float AS receita,
        COUNT(DISTINCT t."appointmentId")::int AS pagos
      FROM "Transaction" t
      ${this.categoryJoin(categoryId)}
      WHERE t."tenantId" = ${tenantId}
        AND t.type = 'INCOME'::"TransactionType"
        AND t."paidAt" BETWEEN ${janela.from} AND ${janela.to}
    `
    return rows[0] ?? { receita: 0, pagos: 0 }
  }

  private async newVsReturning(
    tenantId: string,
    janela: Janela,
    categoryId?: string,
  ): Promise<{ total: number; novos: number }> {
    const categoryFilter = categoryId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "Service" s
          WHERE s.id = a."serviceId" AND s."categoryId" = ${categoryId})`
      : Prisma.empty
    const rows = await prisma.$queryRaw<{ total: number; novos: number }[]>`
      SELECT
        COUNT(DISTINCT a."customerId")::int AS total,
        COUNT(DISTINCT a."customerId")
          FILTER (WHERE c."createdAt" >= ${janela.from})::int AS novos
      FROM "Appointment" a
      JOIN "Customer" c ON c.id = a."customerId"
      WHERE a."tenantId" = ${tenantId}
        AND a."startsAt" BETWEEN ${janela.from} AND ${janela.to}
        AND a.status <> 'CANCELLED'::"AppointmentStatus"
        ${categoryFilter}
    `
    return rows[0] ?? { total: 0, novos: 0 }
  }

  private countAppointments(
    tenantId: string,
    janela: Janela,
    categoryId?: string,
  ): Promise<number> {
    return prisma.appointment.count({
      where: {
        tenantId,
        startsAt: { gte: janela.from, lte: janela.to },
        status: { not: 'CANCELLED' },
        ...(categoryId && { service: { categoryId } }),
      },
    })
  }

  private async series(
    tenantId: string,
    janela: Janela,
    tz: string,
    granularity: Granularity,
    categoryId?: string,
  ): Promise<{ bucket: string; faturamento: number; agendamentos: number }[]> {
    const categoryFilter = categoryId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "Service" s
          WHERE s.id = a."serviceId" AND s."categoryId" = ${categoryId})`
      : Prisma.empty

    const [receitaRows, agendamentoRows] = await Promise.all([
      prisma.$queryRaw<{ bucket: string; valor: number }[]>`
        SELECT
          to_char(date_trunc(${granularity},
            timezone(${tz}, timezone('UTC', t."paidAt"))), 'YYYY-MM-DD') AS bucket,
          COALESCE(SUM(COALESCE(t."netAmount", t.amount)), 0)::float AS valor
        FROM "Transaction" t
        ${this.categoryJoin(categoryId)}
        WHERE t."tenantId" = ${tenantId}
          AND t.type = 'INCOME'::"TransactionType"
          AND t."paidAt" BETWEEN ${janela.from} AND ${janela.to}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ bucket: string; valor: number }[]>`
        SELECT
          to_char(date_trunc(${granularity},
            timezone(${tz}, timezone('UTC', a."startsAt"))), 'YYYY-MM-DD') AS bucket,
          COUNT(*)::int AS valor
        FROM "Appointment" a
        WHERE a."tenantId" = ${tenantId}
          AND a."startsAt" BETWEEN ${janela.from} AND ${janela.to}
          AND a.status <> 'CANCELLED'::"AppointmentStatus"
          ${categoryFilter}
        GROUP BY 1
        ORDER BY 1
      `,
    ])

    const receitaPorBucket = new Map(receitaRows.map((r) => [r.bucket, r.valor]))
    const agendaPorBucket = new Map(agendamentoRows.map((r) => [r.bucket, r.valor]))

    return enumerateBuckets(janela.from, janela.to, granularity, tz).map((bucket) => ({
      bucket,
      faturamento: receitaPorBucket.get(bucket) ?? 0,
      agendamentos: agendaPorBucket.get(bucket) ?? 0,
    }))
  }

  async getSeasonalityReport(
    tenantId: string,
    input: SeasonalityReportInput,
  ): Promise<SeasonalityReport> {
    await featureGuard.assertAccess(tenantId, FEATURES.REPORTS_ADVANCED)

    const { from, to, tz } = await this.resolvePeriodTz(tenantId, input)
    const categoryFilter = input.categoryId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "Service" s
          WHERE s.id = a."serviceId" AND s."categoryId" = ${input.categoryId})`
      : Prisma.empty

    const cells = await prisma.$queryRaw<SeasonalityCell[]>`
      SELECT
        EXTRACT(DOW FROM timezone(${tz}, timezone('UTC', a."startsAt")))::int AS dow,
        EXTRACT(HOUR FROM timezone(${tz}, timezone('UTC', a."startsAt")))::int AS hora,
        COUNT(*)::int AS total
      FROM "Appointment" a
      WHERE a."tenantId" = ${tenantId}
        AND a."startsAt" BETWEEN ${from} AND ${to}
        AND a.status <> 'CANCELLED'::"AppointmentStatus"
        ${input.professionalId ? Prisma.sql`AND a."professionalId" = ${input.professionalId}` : Prisma.empty}
        ${categoryFilter}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `
    const maxTotal = cells.reduce((m, c) => Math.max(m, c.total), 0)
    return { cells, maxTotal }
  }

  async getOverviewReport(
    tenantId: string,
    input: OverviewReportInput,
  ): Promise<OverviewReport> {
    const { from, to, tz } = await this.resolvePeriodTz(tenantId, input)
    const atual: Janela = { from, to }
    const anterior = previousWindow(from, to)
    const granularity = granularityFor(from, to)

    const [
      receitaAtual,
      receitaAnterior,
      clientesAtual,
      clientesAnterior,
      agAtual,
      agAnterior,
      temSerie,
    ] = await Promise.all([
      this.revenueKpis(tenantId, atual, input.categoryId),
      this.revenueKpis(tenantId, anterior, input.categoryId),
      this.newVsReturning(tenantId, atual, input.categoryId),
      this.newVsReturning(tenantId, anterior, input.categoryId),
      this.countAppointments(tenantId, atual, input.categoryId),
      this.countAppointments(tenantId, anterior, input.categoryId),
      featureGuard.canAccess(tenantId, FEATURES.REPORTS_ADVANCED),
    ])

    const ticketAtual =
      receitaAtual.pagos > 0 ? receitaAtual.receita / receitaAtual.pagos : 0
    const ticketAnterior =
      receitaAnterior.pagos > 0 ? receitaAnterior.receita / receitaAnterior.pagos : 0
    const novosPct =
      clientesAtual.total > 0
        ? Math.round((clientesAtual.novos / clientesAtual.total) * 100)
        : 0
    const novosPctAnterior =
      clientesAnterior.total > 0
        ? Math.round((clientesAnterior.novos / clientesAnterior.total) * 100)
        : 0

    const series = temSerie
      ? await this.series(tenantId, atual, tz, granularity, input.categoryId)
      : null

    return {
      kpis: {
        faturamento: receitaAtual.receita,
        agendamentos: agAtual,
        ticketMedio: ticketAtual,
        novosPct,
        variacao: {
          faturamento: percentDelta(receitaAtual.receita, receitaAnterior.receita),
          agendamentos: percentDelta(agAtual, agAnterior),
          ticketMedio: percentDelta(ticketAtual, ticketAnterior),
          novosPctPp: pointsDelta(novosPct, novosPctAnterior),
        },
      },
      granularity,
      series,
    }
  }
}

export const analyticsService = new AnalyticsService()
