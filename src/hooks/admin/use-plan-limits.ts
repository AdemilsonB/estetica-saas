import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type PlanLimit = {
  id: string
  plan: string
  limitKey: string
  value: number
}

async function fetchPlanLimits(planName: string): Promise<PlanLimit[]> {
  const res = await fetch(`/api/admin/plans/${planName}/limits`)
  if (!res.ok) throw new Error('Falha ao carregar limites')
  return res.json()
}

async function updatePlanLimits({
  planName,
  limits,
}: {
  planName: string
  limits: Array<{ limitKey: string; value: number }>
}): Promise<PlanLimit[]> {
  const res = await fetch(`/api/admin/plans/${planName}/limits`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limits }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao salvar limites')
  }
  return res.json()
}

export function usePlanLimits(planName: string) {
  return useQuery({
    queryKey: ['admin', 'plans', planName, 'limits'],
    queryFn: () => fetchPlanLimits(planName),
    enabled: !!planName,
    staleTime: 30_000,
  })
}

export function useUpdatePlanLimits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePlanLimits,
    onSuccess: (_, { planName }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'plans', planName, 'limits'] }),
  })
}
