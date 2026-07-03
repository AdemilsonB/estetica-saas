import { AppointmentStatus, Prisma, TransactionType } from '@prisma/client'

import { prisma } from '@/shared/database/prisma'
import { dayBoundsInTz, monthBoundsInTz } from '@/lib/dates'
import { isReversal } from '@/domains/financial/categories'
import { percentDelta, pointsDelta, previousWindow } from './analytics-utils'

import { CUSTOMERS_PAGE_SIZE } from './types'
import type {
  AppointmentsReport,
  AppointmentsReportInput,
  CustomersReport,
  CustomersReportInput,
  FinancialReport,
  FinancialReportInput,
} from './types'

export class ReportsService {
  // Resolve o período do relatório no timezone do tenant (igual ao dashboard).
  // Sem datas explícitas, o padrão é "mês atual"/"até hoje" calculado no fuso
  // do tenant — não em UTC (o servidor roda em UTC, o que deslocava o período).
  private async resolvePeriod(
    tenantId: string,
    input: { from?: string; to?: string },
  ): Promise<{ from: Date; to: Date }> {
    if (input.from && input.to) {
      return { from: new Date(input.from), to: new Date(input.to) }
    }
    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    })
    const tz = tenant.timezone ?? 'America/Sao_Paulo'
    return {
      from: input.from ? new Date(input.from) : monthBoundsInTz(tz).start,
      to: input.to ? new Date(input.to) : dayBoundsInTz(tz).end,
    }
  }

  async getFinancialReport(
    tenantId: string,
    input: FinancialReportInput,
  ): Promise<FinancialReport> {
    const { from, to } = await this.resolvePeriod(tenantId, input)

    const appointmentFilter = {
      ...(input.professionalId && { professionalId: input.professionalId }),
      ...(input.serviceId && { serviceId: input.serviceId }),
      ...(input.categoryId && { service: { categoryId: input.categoryId } }),
    }

    const baseWhere = {
      tenantId,
      ...(input.type && { type: input.type }),
      ...(Object.keys(appointmentFilter).length > 0 && { appointment: appointmentFilter }),
    }

    const [transactions, prevTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: { ...baseWhere, paidAt: { gte: from, lte: to } },
        include: {
          appointment: {
            include: {
              professional: { select: { id: true, name: true } },
              service: { select: { id: true, name: true } },
            },
          },
        },
      }),
      (() => {
        const prev = previousWindow(from, to)
        return prisma.transaction.findMany({
          where: { ...baseWhere, paidAt: { gte: prev.from, lte: prev.to } },
          select: { type: true, amount: true, netAmount: true, category: true, appointmentId: true },
        })
      })(),
    ])

    const atual = this.summarizeFinancials(transactions)
    const anterior = this.summarizeFinancials(prevTransactions)

    type Group = { groupId: string | null; label: string; quantidade: number; receita: number }
    const byGroup = new Map<string, Group>()
    for (const tx of transactions.filter((t) => t.type === TransactionType.INCOME)) {
      const groupId =
        input.groupBy === 'profissional'
          ? (tx.appointment?.professional?.id ?? null)
          : (tx.appointment?.service?.id ?? null)
      const label =
        input.groupBy === 'profissional'
          ? (tx.appointment?.professional?.name ?? 'Sem profissional')
          : (tx.appointment?.service?.name ?? 'Sem serviço')
      const key = groupId ?? label
      const prev = byGroup.get(key) ?? { groupId, label, quantidade: 0, receita: 0 }
      byGroup.set(key, {
        groupId,
        label,
        quantidade: prev.quantidade + 1,
        receita: prev.receita + Number(tx.netAmount ?? tx.amount),
      })
    }
    const rows = [...byGroup.values()]
      .map((g) => ({ ...g, ticketMedio: g.quantidade > 0 ? g.receita / g.quantidade : 0 }))
      .sort((a, b) => b.receita - a.receita)

    return {
      kpis: {
        receita: atual.receita,
        despesa: atual.despesa,
        estornos: atual.estornos,
        saldo: atual.receita - atual.despesa,
        ticketMedio: atual.ticketMedio,
        variacao: {
          receita: percentDelta(atual.receita, anterior.receita),
          despesa: percentDelta(atual.despesa, anterior.despesa),
          saldo: percentDelta(atual.receita - atual.despesa, anterior.receita - anterior.despesa),
          ticketMedio: percentDelta(atual.ticketMedio, anterior.ticketMedio),
        },
      },
      rows,
    }
  }

  // Resume receita/despesa/estornos/ticket de um conjunto de transações
  // (mesma regra para o período atual e o anterior).
  private summarizeFinancials(
    transactions: Array<{
      type: TransactionType
      amount: unknown
      netAmount: unknown
      category: string | null
      appointmentId: string | null
    }>,
  ): { receita: number; despesa: number; estornos: number; ticketMedio: number } {
    const isReversalTx = (t: (typeof transactions)[0]) => isReversal(t.category ?? '', Number(t.amount))

    const receita = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + Number(t.netAmount ?? t.amount), 0)

    const estornos = transactions
      .filter((t) => t.type === TransactionType.EXPENSE && isReversalTx(t))
      .reduce((s, t) => s + Math.abs(Number(t.netAmount ?? t.amount)), 0)

    const grossExpenses = transactions
      .filter((t) => t.type === TransactionType.EXPENSE && !isReversalTx(t))
      .reduce((s, t) => s + Number(t.netAmount ?? t.amount), 0)

    const despesa = Math.max(0, grossExpenses - estornos)

    const appointmentIdsComReceita = new Set(
      transactions
        .filter((t) => t.type === TransactionType.INCOME && t.appointmentId !== null)
        .map((t) => t.appointmentId as string),
    )
    const ticketMedio =
      appointmentIdsComReceita.size > 0 ? receita / appointmentIdsComReceita.size : 0

    return { receita, despesa, estornos, ticketMedio }
  }

  async getAppointmentsReport(
    tenantId: string,
    input: AppointmentsReportInput,
  ): Promise<AppointmentsReport> {
    const { from, to } = await this.resolvePeriod(tenantId, input)

    const appointmentWhere = {
      tenantId,
      startsAt: { gte: from, lte: to },
      ...(input.status?.length && { status: { in: input.status } }),
      ...(input.professionalId && { professionalId: input.professionalId }),
      ...(input.serviceId && { serviceId: input.serviceId }),
      ...(input.categoryId && { service: { categoryId: input.categoryId } }),
    }

    const appointments = await prisma.appointment.findMany({
      where: appointmentWhere,
      include: {
        professional: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    })

    const total = appointments.length
    const concluidos = appointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length
    const cancelados = appointments.filter((a) => a.status === AppointmentStatus.CANCELLED).length
    const naoCompareceu = appointments.filter((a) => a.status === AppointmentStatus.NO_SHOW).length
    const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0

    // Busca janela anterior por agregação (sem carregar linhas completas)
    const prev = previousWindow(from, to)
    const prevGroups = await prisma.appointment.groupBy({
      by: ['status'],
      where: {
        tenantId,
        startsAt: { gte: prev.from, lte: prev.to },
        ...(input.status?.length && { status: { in: input.status } }),
        ...(input.professionalId && { professionalId: input.professionalId }),
        ...(input.serviceId && { serviceId: input.serviceId }),
        ...(input.categoryId && { service: { categoryId: input.categoryId } }),
      },
      _count: { _all: true },
    })
    const prevTotal = prevGroups.reduce((s, g) => s + g._count._all, 0)
    const prevConcluidos =
      prevGroups.find((g) => g.status === AppointmentStatus.COMPLETED)?._count._all ?? 0
    const prevTaxa = prevTotal > 0 ? Math.round((prevConcluidos / prevTotal) * 100) : 0

    type RowAcc = { label: string; total: number; concluidos: number; cancelados: number; naoCompareceu: number }
    const byGroup = new Map<string, RowAcc>()
    for (const apt of appointments) {
      const label =
        input.groupBy === 'servico'
          ? (apt.service?.name ?? 'Sem serviço')
          : (apt.professional?.name ?? 'Sem profissional')
      const prevRow = byGroup.get(label) ?? { label, total: 0, concluidos: 0, cancelados: 0, naoCompareceu: 0 }
      byGroup.set(label, {
        label,
        total: prevRow.total + 1,
        concluidos: prevRow.concluidos + (apt.status === AppointmentStatus.COMPLETED ? 1 : 0),
        cancelados: prevRow.cancelados + (apt.status === AppointmentStatus.CANCELLED ? 1 : 0),
        naoCompareceu: prevRow.naoCompareceu + (apt.status === AppointmentStatus.NO_SHOW ? 1 : 0),
      })
    }
    const rows = [...byGroup.values()].sort((a, b) => b.total - a.total)

    return {
      kpis: {
        total,
        concluidos,
        cancelados,
        naoCompareceu,
        taxaConclusao,
        variacao: {
          total: percentDelta(total, prevTotal),
          concluidos: percentDelta(concluidos, prevConcluidos),
          taxaConclusaoPp: pointsDelta(taxaConclusao, prevTaxa),
        },
      },
      rows,
    }
  }

  async getCustomersReport(
    tenantId: string,
    input: CustomersReportInput,
  ): Promise<CustomersReport> {
    const { from, to } = await this.resolvePeriod(tenantId, input)
    const page = input.page ?? 1
    const sortBy = input.sortBy ?? 'receita'
    const offset = (page - 1) * CUSTOMERS_PAGE_SIZE
    const prev = previousWindow(from, to)

    // Filtros compartilhados entre ranking (SQL) e KPIs (Prisma).
    const sqlFilters = Prisma.sql`
      a."tenantId" = ${tenantId}
      AND a."startsAt" BETWEEN ${from} AND ${to}
      AND a.status <> 'CANCELLED'::"AppointmentStatus"
      ${input.professionalId ? Prisma.sql`AND a."professionalId" = ${input.professionalId}` : Prisma.empty}
      ${input.serviceId ? Prisma.sql`AND a."serviceId" = ${input.serviceId}` : Prisma.empty}
    `
    const orderBy =
      sortBy === 'atendimentos'
        ? Prisma.sql`atendimentos DESC`
        : sortBy === 'ticketMedio'
          ? Prisma.sql`"ticketMedio" DESC`
          : Prisma.sql`receita DESC`

    const whereBase = (janela: { from: Date; to: Date }) => ({
      tenantId,
      startsAt: { gte: janela.from, lte: janela.to },
      status: { not: AppointmentStatus.CANCELLED },
      ...(input.professionalId && { professionalId: input.professionalId }),
      ...(input.serviceId && { serviceId: input.serviceId }),
    })

    type RawRow = {
      id: string
      clienteNome: string
      atendimentos: number
      receita: number
      ticketMedio: number
      ultimoAtendimento: Date
    }

    const [rawRows, totalRows, curGroups, prevGroups, novos, novosPrev] = await Promise.all([
      prisma.$queryRaw<RawRow[]>`
        SELECT
          c.id,
          c.name AS "clienteNome",
          COUNT(DISTINCT a.id)::int AS atendimentos,
          COALESCE(SUM(CASE WHEN t.type = 'INCOME'::"TransactionType"
            THEN COALESCE(t."netAmount", t.amount) ELSE 0 END), 0)::float AS receita,
          (COALESCE(SUM(CASE WHEN t.type = 'INCOME'::"TransactionType"
            THEN COALESCE(t."netAmount", t.amount) ELSE 0 END), 0)
            / COUNT(DISTINCT a.id))::float AS "ticketMedio",
          MAX(a."startsAt") AS "ultimoAtendimento"
        FROM "Appointment" a
        JOIN "Customer" c ON c.id = a."customerId"
        LEFT JOIN "Transaction" t ON t."appointmentId" = a.id
        WHERE ${sqlFilters}
        GROUP BY c.id, c.name
        ORDER BY ${orderBy}
        LIMIT ${CUSTOMERS_PAGE_SIZE} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(DISTINCT a."customerId")::int AS total
        FROM "Appointment" a
        WHERE ${sqlFilters}
      `,
      prisma.appointment.groupBy({
        by: ['customerId'],
        where: whereBase({ from, to }),
        _count: { _all: true },
      }),
      prisma.appointment.groupBy({
        by: ['customerId'],
        where: whereBase(prev),
        _count: { _all: true },
      }),
      prisma.customer.count({ where: { tenantId, createdAt: { gte: from, lte: to } } }),
      prisma.customer.count({ where: { tenantId, createdAt: { gte: prev.from, lte: prev.to } } }),
    ])

    const totalAtivos = curGroups.length
    const retorno = curGroups.filter((g) => g._count._all >= 2).length
    const prevAtivos = prevGroups.length
    const prevRetorno = prevGroups.filter((g) => g._count._all >= 2).length

    return {
      kpis: {
        totalAtivos,
        novosNoPeriodo: novos,
        retorno,
        variacao: {
          totalAtivos: percentDelta(totalAtivos, prevAtivos),
          novosNoPeriodo: percentDelta(novos, novosPrev),
          retorno: percentDelta(retorno, prevRetorno),
        },
      },
      rows: rawRows.map((r) => ({
        clienteId: r.id,
        clienteNome: r.clienteNome,
        atendimentos: r.atendimentos,
        receita: r.receita,
        ticketMedio: r.ticketMedio,
        ultimoAtendimento: r.ultimoAtendimento.toISOString(),
      })),
      total: totalRows[0]?.total ?? 0,
      page,
      pageSize: CUSTOMERS_PAGE_SIZE,
    }
  }

}

export const reportsService = new ReportsService()
