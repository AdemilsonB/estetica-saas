import { useQuery } from '@tanstack/react-query'

export type MrrData = {
  mrr: number
  arr: number
  newPayingThisMonth: number
  churnThisMonth: number
  trialToActiveThisMonth: number
  totalActivePaying: number
  trialing: number
  trialConversionRate: number
}

async function fetchMrr(): Promise<MrrData> {
  const res = await fetch('/api/admin/mrr')
  if (!res.ok) throw new Error('Falha ao carregar métricas')
  return res.json()
}

export function useAdminMrr() {
  return useQuery({
    queryKey: ['admin', 'mrr'],
    queryFn: fetchMrr,
    staleTime: 3_600_000,
  })
}
