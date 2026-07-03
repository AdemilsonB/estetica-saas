import { useQuery } from '@tanstack/react-query'
import type { SeasonalityReport } from '@/domains/reports/types'
import { fetchReport, retryUnlessLocked } from './report-fetcher'

export type SeasonalityParams = {
  from?: string
  to?: string
  professionalId?: string
  categoryId?: string
}

async function fetchSeasonality(params: SeasonalityParams): Promise<SeasonalityReport> {
  const url = new URL('/api/reports/seasonality', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.categoryId) url.searchParams.set('categoryId', params.categoryId)
  return fetchReport<SeasonalityReport>(url)
}

export function useSeasonalityReport(params: SeasonalityParams) {
  return useQuery({
    queryKey: ['reports', 'seasonality', params],
    queryFn: () => fetchSeasonality(params),
    staleTime: 60_000,
    retry: (count, err) => retryUnlessLocked(count, err as Error),
  })
}
