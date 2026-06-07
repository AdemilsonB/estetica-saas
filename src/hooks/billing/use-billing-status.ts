import { useQuery } from '@tanstack/react-query'

type BillingStatus = {
  plan: string
  status: string
  trialEndsAt: string | null
  stripeSubId: string | null
  features: Record<string, boolean>
  limits: {
    users: { current: number; max: number }
    appointments_month: { current: number; max: number }
  }
}

async function fetchBillingStatus(): Promise<BillingStatus> {
  const res = await fetch('/api/billing/status')
  if (!res.ok) throw new Error('Erro ao buscar status do plano')
  return res.json()
}

export function useBillingStatus() {
  return useQuery({
    queryKey: ['billing', 'status'],
    queryFn: fetchBillingStatus,
    staleTime: 5 * 60 * 1000,
  })
}
