import { useQuery } from '@tanstack/react-query'
import type { UsageItem } from '@/domains/billing/usage.service'

type UsageResponse = {
  items: UsageItem[]
}

async function fetchUsage(): Promise<UsageResponse> {
  const res = await fetch('/api/billing/usage')
  if (!res.ok) throw new Error('Erro ao buscar uso do plano')
  return res.json()
}

export function useUsage() {
  return useQuery({
    queryKey: ['billing', 'usage'],
    queryFn: fetchUsage,
    staleTime: 60 * 1000,
  })
}
