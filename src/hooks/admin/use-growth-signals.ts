import { useQuery } from '@tanstack/react-query'
import type { GrowthSignals } from '@/domains/billing/growth-signals.service'

async function fetchGrowthSignals(): Promise<GrowthSignals> {
  const res = await fetch('/api/admin/growth-signals')
  if (!res.ok) throw new Error('Falha ao carregar sinais de crescimento')
  return res.json()
}

export function useGrowthSignals() {
  return useQuery({ queryKey: ['admin', 'growth-signals'], queryFn: fetchGrowthSignals, staleTime: 60_000 })
}
