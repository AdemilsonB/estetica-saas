import { useQuery } from '@tanstack/react-query'

export type PlanData = {
  name: string
  displayName: string
  price: number
  trialDays: number
  limits: Record<string, number>
}

async function fetchPlans(): Promise<{ plans: PlanData[] }> {
  const res = await fetch('/api/billing/plans')
  if (!res.ok) throw new Error('Erro ao buscar planos')
  return res.json()
}

export function usePlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: fetchPlans,
    staleTime: 10 * 60 * 1000,
  })
}
