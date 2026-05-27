// src/hooks/crm/use-customers-search.ts
import { useQuery } from '@tanstack/react-query'

export type CustomerSummary = {
  id: string
  name: string
  phone: string | null
}

async function searchCustomers(q: string): Promise<CustomerSummary[]> {
  if (q.trim().length < 2) return []
  const url = new URL('/api/crm/customers', window.location.origin)
  url.searchParams.set('search', q)
  url.searchParams.set('limit', '10')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao buscar clientes')
  const result: { data: CustomerSummary[] } = await res.json()
  return result.data
}

export function useCustomersSearch(query: string) {
  return useQuery({
    queryKey: ['customers-search', query],
    queryFn: () => searchCustomers(query),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000,
  })
}
