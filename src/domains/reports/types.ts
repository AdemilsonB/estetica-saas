import { AppointmentStatus, TransactionType } from '@prisma/client'
import { z } from 'zod'

import type { Granularity, KpiDelta } from './analytics-utils'

// ── Financeiro ──────────────────────────────────────────────────────────────

export const financialReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  professionalId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  groupBy: z.enum(['profissional', 'servico']).default('servico'),
})

export type FinancialReportInput = z.infer<typeof financialReportSchema>

export type FinancialReportRow = {
  groupId: string | null
  label: string
  quantidade: number
  receita: number
  ticketMedio: number
}

export type FinancialReport = {
  kpis: {
    receita: number
    despesa: number
    estornos: number
    saldo: number
    ticketMedio: number
    variacao: {
      receita: KpiDelta
      despesa: KpiDelta
      saldo: KpiDelta
      ticketMedio: KpiDelta
    }
  }
  rows: FinancialReportRow[]
}

// ── Agendamentos ─────────────────────────────────────────────────────────────

export const appointmentsReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.array(z.nativeEnum(AppointmentStatus)).optional(),
  professionalId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  groupBy: z.enum(['profissional', 'servico']).default('profissional'),
})

export type AppointmentsReportInput = z.infer<typeof appointmentsReportSchema>

export type AppointmentsReportRow = {
  label: string
  total: number
  concluidos: number
  cancelados: number
  naoCompareceu: number
}

export type AppointmentsReport = {
  kpis: {
    total: number
    concluidos: number
    cancelados: number
    naoCompareceu: number
    taxaConclusao: number
    variacao: {
      total: KpiDelta
      concluidos: KpiDelta
      taxaConclusaoPp: number
    }
  }
  rows: AppointmentsReportRow[]
}

// ── Clientes ──────────────────────────────────────────────────────────────────

export const CUSTOMERS_PAGE_SIZE = 20

export const customersReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  professionalId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(['receita', 'atendimentos', 'ticketMedio']).default('receita'),
})

export type CustomersReportInput = z.infer<typeof customersReportSchema>

export type CustomersReportRow = {
  clienteId: string
  clienteNome: string
  atendimentos: number
  receita: number
  ticketMedio: number
  ultimoAtendimento: string
}

export type CustomersReport = {
  kpis: {
    totalAtivos: number
    novosNoPeriodo: number
    retorno: number
    variacao: {
      totalAtivos: KpiDelta
      novosNoPeriodo: KpiDelta
      retorno: KpiDelta
    }
  }
  rows: CustomersReportRow[]
  total: number
  page: number
  pageSize: number
}

// ── Profissionais ─────────────────────────────────────────────────────────────

export const professionalsReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  professionalIds: z.array(z.string().cuid()).optional(),
  serviceId: z.string().cuid().optional(),
  status: z.array(z.nativeEnum(AppointmentStatus)).optional(),
})

export type ProfessionalsReportInput = z.infer<typeof professionalsReportSchema>

export type ProfessionalsReportRow = {
  profissionalNome: string
  atendimentos: number
  receita: number
  ticketMedio: number
}

export type ProfessionalsReport = {
  kpis: {
    totalAtendimentos: number
    receitaTotal: number
  }
  rows: ProfessionalsReportRow[]
}

// ── Visão Geral ───────────────────────────────────────────────────────────────

export const overviewReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  categoryId: z.string().cuid().optional(),
})

export type OverviewReportInput = z.infer<typeof overviewReportSchema>

export type OverviewSeriesPoint = {
  bucket: string
  faturamento: number
  agendamentos: number
}

export type OverviewReport = {
  kpis: {
    faturamento: number
    agendamentos: number
    ticketMedio: number
    novosPct: number
    variacao: {
      faturamento: KpiDelta
      agendamentos: KpiDelta
      ticketMedio: KpiDelta
      novosPctPp: number
    }
  }
  granularity: Granularity
  series: OverviewSeriesPoint[] | null
}

// ── Clientes inativos ─────────────────────────────────────────────────────────

export const inactiveCustomersSchema = z.object({
  days: z.coerce.number().int().min(15).max(365).default(90),
  page: z.coerce.number().int().min(1).default(1),
})

export type InactiveCustomersInput = z.infer<typeof inactiveCustomersSchema>

export type InactiveCustomerRow = {
  clienteId: string
  nome: string
  telefone: string | null
  ultimoAtendimento: string
  diasInativo: number
  valorHistorico: number
}

export type InactiveCustomersReport = {
  rows: InactiveCustomerRow[]
  total: number
  page: number
  pageSize: number
}

// ── Sazonalidade ──────────────────────────────────────────────────────────────

export const seasonalityReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  professionalId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
})

export type SeasonalityReportInput = z.infer<typeof seasonalityReportSchema>

export type SeasonalityCell = { dow: number; hora: number; total: number }

export type SeasonalityReport = {
  cells: SeasonalityCell[]
  maxTotal: number
}
