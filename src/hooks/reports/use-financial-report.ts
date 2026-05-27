import { useQuery } from '@tanstack/react-query'
import type { FinancialReport } from '@/domains/reports/types'

export type FinancialReportParams = {
  from?: string
  to?: string
  type?: 'INCOME' | 'EXPENSE'
  professionalId?: string
  serviceId?: string
  groupBy?: 'profissional' | 'servico'
}

async function fetchFinancialReport(params: FinancialReportParams): Promise<FinancialReport> {
  const url = new URL('/api/reports/financial', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.type) url.searchParams.set('type', params.type)
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.serviceId) url.searchParams.set('serviceId', params.serviceId)
  if (params.groupBy) url.searchParams.set('groupBy', params.groupBy)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar relatório financeiro')
  return res.json()
}

export function useFinancialReport(params: FinancialReportParams) {
  return useQuery({
    queryKey: ['reports', 'financial', params],
    queryFn: () => fetchFinancialReport(params),
    staleTime: 60_000,
  })
}
