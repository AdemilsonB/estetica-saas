import { useQuery } from '@tanstack/react-query'
import type { ActivationStatus } from '@/domains/activation/types'

async function fetchActivationStatus(): Promise<ActivationStatus> {
  const res = await fetch('/api/activation/status')
  if (!res.ok) throw new Error('Falha ao carregar status de ativação')
  return res.json()
}

export function useActivationStatus() {
  return useQuery({
    queryKey: ['activation-status'],
    queryFn: fetchActivationStatus,
    staleTime: 60 * 1000,
  })
}
