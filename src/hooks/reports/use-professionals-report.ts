import { useQuery } from '@tanstack/react-query'
import type { ProfessionalsReport } from '@/domains/reports/types'

export type ProfessionalsReportParams = {
  from?: string
  to?: string
  professionalIds?: string[]
  serviceId?: string
  status?: string[]
}

async function fetchProfessionalsReport(params: ProfessionalsReportParams): Promise<ProfessionalsReport> {
  const url = new URL('/api/reports/professionals', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  params.professionalIds?.forEach((id) => url.searchParams.append('professionalIds', id))
  if (params.serviceId) url.searchParams.set('serviceId', params.serviceId)
  params.status?.forEach((s) => url.searchParams.append('status', s))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar relatório de profissionais')
  return res.json()
}

export function useProfessionalsReport(params: ProfessionalsReportParams) {
  return useQuery({
    queryKey: ['reports', 'professionals', params],
    queryFn: () => fetchProfessionalsReport(params),
    staleTime: 60_000,
  })
}
