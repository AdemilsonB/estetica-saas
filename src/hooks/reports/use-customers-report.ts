import { useQuery } from '@tanstack/react-query'
import type { CustomersReport } from '@/domains/reports/types'

export type CustomersReportParams = {
  from?: string
  to?: string
  professionalId?: string
  serviceId?: string
}

async function fetchCustomersReport(params: CustomersReportParams): Promise<CustomersReport> {
  const url = new URL('/api/reports/customers', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.serviceId) url.searchParams.set('serviceId', params.serviceId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar relatório de clientes')
  return res.json()
}

export function useCustomersReport(params: CustomersReportParams) {
  return useQuery({
    queryKey: ['reports', 'customers', params],
    queryFn: () => fetchCustomersReport(params),
    staleTime: 60_000,
  })
}
