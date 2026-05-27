import { useQuery } from '@tanstack/react-query'
import type { AppointmentsReport } from '@/domains/reports/types'

export type AppointmentsReportParams = {
  from?: string
  to?: string
  status?: string[]
  professionalId?: string
  serviceId?: string
  groupBy?: 'profissional' | 'servico'
}

async function fetchAppointmentsReport(params: AppointmentsReportParams): Promise<AppointmentsReport> {
  const url = new URL('/api/reports/appointments', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  params.status?.forEach((s) => url.searchParams.append('status', s))
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.serviceId) url.searchParams.set('serviceId', params.serviceId)
  if (params.groupBy) url.searchParams.set('groupBy', params.groupBy)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar relatório de agendamentos')
  return res.json()
}

export function useAppointmentsReport(params: AppointmentsReportParams) {
  return useQuery({
    queryKey: ['reports', 'appointments', params],
    queryFn: () => fetchAppointmentsReport(params),
    staleTime: 60_000,
  })
}
