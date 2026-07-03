import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { InactiveCustomersReport } from '@/domains/reports/types'
import { fetchReport, retryUnlessLocked } from './report-fetcher'

export type InactiveCustomersParams = {
  days: number
  page: number
}

async function fetchInactive(params: InactiveCustomersParams): Promise<InactiveCustomersReport> {
  const url = new URL('/api/reports/customers/inactive', window.location.origin)
  url.searchParams.set('days', String(params.days))
  url.searchParams.set('page', String(params.page))
  return fetchReport<InactiveCustomersReport>(url)
}

export function useInactiveCustomers(params: InactiveCustomersParams) {
  return useQuery({
    queryKey: ['reports', 'customers-inactive', params],
    queryFn: () => fetchInactive(params),
    staleTime: 60_000,
    retry: (count, err) => retryUnlessLocked(count, err as Error),
    placeholderData: keepPreviousData,
  })
}
