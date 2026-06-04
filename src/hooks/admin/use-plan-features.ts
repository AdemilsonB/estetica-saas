import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type PlanFeature = {
  id: string
  plan: string
  sectionKey: string
  enabled: boolean
}

async function fetchPlanFeatures(planName: string): Promise<PlanFeature[]> {
  const res = await fetch(`/api/admin/plans/${planName}/features`)
  if (!res.ok) throw new Error('Falha ao carregar features')
  return res.json()
}

async function updatePlanFeatures({
  planName,
  features,
}: {
  planName: string
  features: Array<{ sectionKey: string; enabled: boolean }>
}): Promise<PlanFeature[]> {
  const res = await fetch(`/api/admin/plans/${planName}/features`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao salvar features')
  }
  return res.json()
}

export function usePlanFeatures(planName: string) {
  return useQuery({
    queryKey: ['admin', 'plans', planName, 'features'],
    queryFn: () => fetchPlanFeatures(planName),
    enabled: !!planName,
    staleTime: 30_000,
  })
}

export function useUpdatePlanFeatures() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePlanFeatures,
    onSuccess: (_, { planName }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'plans', planName, 'features'] }),
  })
}
