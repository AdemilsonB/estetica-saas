import { useQuery } from '@tanstack/react-query'

type MonthlyCountsResult = {
  counts: Record<string, number>
  capacity: number
}

async function fetchMonthlyAppointmentCounts(
  year: number,
  month: number,
): Promise<MonthlyCountsResult> {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999)
  const url = new URL('/api/scheduling/appointments/counts', window.location.origin)
  url.searchParams.set('from', from.toISOString())
  url.searchParams.set('to', to.toISOString())
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar contagens do mês')
  return res.json()
}

export function useMonthlyAppointmentCounts(year: number, month: number) {
  return useQuery({
    queryKey: ['appointment-counts', year, month],
    queryFn: () => fetchMonthlyAppointmentCounts(year, month),
    staleTime: 30 * 1000,
  })
}
