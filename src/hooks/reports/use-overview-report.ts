import { useQuery } from '@tanstack/react-query'
import type { OverviewReport } from '@/domains/reports/types'
import { fetchReport, retryUnlessLocked } from './report-fetcher'

export type OverviewReportParams = {
  from?: string
  to?: string
  categoryId?: string
}

async function fetchOverview(params: OverviewReportParams): Promise<OverviewReport> {
  const url = new URL('/api/reports/overview', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.categoryId) url.searchParams.set('categoryId', params.categoryId)
  return fetchReport<OverviewReport>(url)
}

export function useOverviewReport(params: OverviewReportParams) {
  return useQuery({
    queryKey: ['reports', 'overview', params],
    queryFn: () => fetchOverview(params),
    staleTime: 60_000,
    retry: (count, err) => retryUnlessLocked(count, err as Error),
  })
}
