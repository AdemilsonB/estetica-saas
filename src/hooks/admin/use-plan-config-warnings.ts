import { useQuery } from '@tanstack/react-query'
import type { PlanConfigWarning } from '@/domains/billing/plan-config-sanity.service'

async function fetchWarnings(): Promise<PlanConfigWarning[]> {
  const res = await fetch('/api/admin/plans/sanity')
  if (!res.ok) throw new Error('Falha ao carregar avisos de configuração')
  return res.json()
}

export function usePlanConfigWarnings() {
  return useQuery({ queryKey: ['admin', 'plan-config-warnings'], queryFn: fetchWarnings, staleTime: 60_000 })
}
