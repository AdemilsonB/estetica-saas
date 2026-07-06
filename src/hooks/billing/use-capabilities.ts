import { useQuery } from '@tanstack/react-query'
import type { CapabilityStatus } from '@/domains/billing/capabilities.service'
import type { PublicPlan } from '@/domains/billing/plan-catalog.service'

async function fetchCapabilities(): Promise<CapabilityStatus[]> {
  const res = await fetch('/api/billing/capabilities')
  if (!res.ok) throw new Error('Falha ao carregar capacidades')
  return res.json()
}

export function useCapabilities() {
  return useQuery({
    queryKey: ['billing', 'capabilities'],
    queryFn: fetchCapabilities,
    staleTime: 5 * 60 * 1000,
    select: (list): Record<string, CapabilityStatus> =>
      Object.fromEntries(list.map((c) => [c.key, c])),
  })
}

async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const res = await fetch('/api/public/plans')
  if (!res.ok) throw new Error('Falha ao carregar planos')
  return res.json()
}

export function usePublicPlans() {
  return useQuery({
    queryKey: ['billing', 'public-plans'],
    queryFn: fetchPublicPlans,
    staleTime: 5 * 60 * 1000,
  })
}
