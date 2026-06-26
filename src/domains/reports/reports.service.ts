import { AppointmentStatus, TransactionType } from '@prisma/client'

import { prisma } from '@/shared/database/prisma'
import { dayBoundsInTz, monthBoundsInTz } from '@/lib/dates'
import { featureGuard, FEATURES } from '@/domains/billing/feature-guard'
import { isReversal } from '@/domains/financial/categories'

import type {
  AppointmentsReport,
  AppointmentsReportInput,
  CustomersReport,
  CustomersReportInput,
  FinancialReport,
  FinancialReportInput,
  ProfessionalsReport,
  ProfessionalsReportInput,
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

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        ...(input.type && { type: input.type }),
        paidAt: { gte: from, lte: to },
        ...((input.professionalId || input.serviceId) && {
          appointment: {
            ...(input.professionalId && { professionalId: input.professionalId }),
            ...(input.serviceId && { serviceId: input.serviceId }),
          },
        }),
      },
      include: {
        appointment: {
          include: {
            professional: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
    })

    const isReversalTx = (t: (typeof transactions)[0]) =>
      isReversal(t.category, Number(t.amount))

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
        .filter((t) => t.type === TransactionType.INCOME && t.appointmentId)
        .map((t) => t.appointmentId),
    )
    const ticketMedio =
      appointmentIdsComReceita.size > 0 ? receita / appointmentIdsComReceita.size : 0

    const byGroup = new Map<string, { label: string; quantidade: number; receita: number }>()
    for (const tx of transactions.filter((t) => t.type === TransactionType.INCOME)) {
      const label =
        input.groupBy === 'profissional'
          ? (tx.appointment?.professional?.name ?? 'Sem profissional')
          : (tx.appointment?.service?.name ?? 'Sem serviço')
      const prev = byGroup.get(label) ?? { label, quantidade: 0, receita: 0 }
      byGroup.set(label, {
        label,
        quantidade: prev.quantidade + 1,
        receita: prev.receita + Number(tx.netAmount ?? tx.amount),
      })
    }
    const rows = [...byGroup.values()].sort((a, b) => b.receita - a.receita)

    return {
      kpis: { receita, despesa, estornos, saldo: receita - despesa, ticketMedio },
      rows,
    }
  }

  async getAppointmentsReport(
    tenantId: string,
    input: AppointmentsReportInput,
  ): Promise<AppointmentsReport> {
    const { from, to } = await this.resolvePeriod(tenantId, input)

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        startsAt: { gte: from, lte: to },
        ...(input.status?.length && { status: { in: input.status } }),
        ...(input.professionalId && { professionalId: input.professionalId }),
        ...(input.serviceId && { serviceId: input.serviceId }),
      },
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

    type RowAcc = { label: string; total: number; concluidos: number; cancelados: number; naoCompareceu: number }
    const byGroup = new Map<string, RowAcc>()
    for (const apt of appointments) {
      const label =
        input.groupBy === 'servico'
          ? (apt.service?.name ?? 'Sem serviço')
          : (apt.professional?.name ?? 'Sem profissional')
      const prev = byGroup.get(label) ?? { label, total: 0, concluidos: 0, cancelados: 0, naoCompareceu: 0 }
      byGroup.set(label, {
        label,
        total: prev.total + 1,
        concluidos: prev.concluidos + (apt.status === AppointmentStatus.COMPLETED ? 1 : 0),
        cancelados: prev.cancelados + (apt.status === AppointmentStatus.CANCELLED ? 1 : 0),
        naoCompareceu: prev.naoCompareceu + (apt.status === AppointmentStatus.NO_SHOW ? 1 : 0),
      })
    }
    const rows = [...byGroup.values()].sort((a, b) => b.total - a.total)

    return { kpis: { total, concluidos, cancelados, naoCompareceu, taxaConclusao }, rows }
  }

  async getCustomersReport(
    tenantId: string,
    input: CustomersReportInput,
  ): Promise<CustomersReport> {
    const { from, to } = await this.resolvePeriod(tenantId, input)

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        startsAt: { gte: from, lte: to },
        status: { not: AppointmentStatus.CANCELLED },
        ...(input.professionalId && { professionalId: input.professionalId }),
        ...(input.serviceId && { serviceId: input.serviceId }),
      },
      include: {
        customer: { select: { id: true, name: true } },
        transactions: { select: { amount: true, netAmount: true, type: true } },
      },
      orderBy: { startsAt: 'desc' },
    })

    type CustomerAcc = {
      nome: string
      atendimentos: number
      receita: number
      ultimoAtendimento: Date
    }
    const byCustomer = new Map<string, CustomerAcc>()
    for (const apt of appointments) {
      const prev = byCustomer.get(apt.customerId)
      const receita = apt.transactions
        .filter((t) => t.type === TransactionType.INCOME)
        .reduce((s, t) => s + Number(t.netAmount ?? t.amount), 0)
      byCustomer.set(apt.customerId, {
        nome: apt.customer.name,
        atendimentos: (prev?.atendimentos ?? 0) + 1,
        receita: (prev?.receita ?? 0) + receita,
        ultimoAtendimento: prev
          ? prev.ultimoAtendimento > apt.startsAt
            ? prev.ultimoAtendimento
            : apt.startsAt
          : apt.startsAt,
      })
    }

    const totalAtivos = byCustomer.size
    const retorno = [...byCustomer.values()].filter((c) => c.atendimentos >= 2).length

    const novosNoPeriodo = await prisma.customer.count({
      where: { tenantId, createdAt: { gte: from, lte: to } },
    })

    const rows = [...byCustomer.values()]
      .sort((a, b) => b.atendimentos - a.atendimentos)
      .map((c) => ({
        clienteNome: c.nome,
        atendimentos: c.atendimentos,
        receita: c.receita,
        ultimoAtendimento: c.ultimoAtendimento.toISOString(),
      }))

    return { kpis: { totalAtivos, novosNoPeriodo, retorno }, rows }
  }

  async getProfessionalsReport(
    tenantId: string,
    input: ProfessionalsReportInput,
  ): Promise<ProfessionalsReport> {
    await featureGuard.assertAccess(tenantId, FEATURES.REPORTS_ADVANCED)

    const { from, to } = await this.resolvePeriod(tenantId, input)

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        startsAt: { gte: from, lte: to },
        ...(input.status?.length && { status: { in: input.status } }),
        ...(input.professionalIds?.length && {
          professionalId: { in: input.professionalIds },
        }),
        ...(input.serviceId && { serviceId: input.serviceId }),
      },
      include: {
        professional: { select: { id: true, name: true } },
        transactions: { select: { amount: true, netAmount: true, type: true } },
      },
    })

    type ProfAcc = { nome: string; atendimentos: number; receita: number }
    const byProf = new Map<string, ProfAcc>()
    for (const apt of appointments) {
      const prev = byProf.get(apt.professionalId)
      const receita = apt.transactions
        .filter((t) => t.type === TransactionType.INCOME)
        .reduce((s, t) => s + Number(t.netAmount ?? t.amount), 0)
      byProf.set(apt.professionalId, {
        nome: apt.professional.name,
        atendimentos: (prev?.atendimentos ?? 0) + 1,
        receita: (prev?.receita ?? 0) + receita,
      })
    }

    const totalAtendimentos = appointments.length
    const receitaTotal = [...byProf.values()].reduce((s, p) => s + p.receita, 0)

    const rows = [...byProf.values()]
      .sort((a, b) => b.receita - a.receita)
      .map((p) => ({
        profissionalNome: p.nome,
        atendimentos: p.atendimentos,
        receita: p.receita,
        ticketMedio: p.atendimentos > 0 ? p.receita / p.atendimentos : 0,
      }))

    return { kpis: { totalAtendimentos, receitaTotal }, rows }
  }
}

export const reportsService = new ReportsService()
