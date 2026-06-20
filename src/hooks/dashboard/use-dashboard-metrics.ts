import { useQuery } from '@tanstack/react-query'

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type DashboardMetrics = {
  byStatus: Record<AppointmentStatus, number>
  byProfessional: Array<{ id: string; name: string; count: number }>
  revenue: { today: number; month: number }
}

async function fetchMetrics(): Promise<DashboardMetrics> {
  const res = await fetch('/api/dashboard/metrics')
  if (!res.ok) throw new Error('Falha ao carregar métricas')
  return res.json()
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 30_000,
    staleTime: 30_000,
  })
}
