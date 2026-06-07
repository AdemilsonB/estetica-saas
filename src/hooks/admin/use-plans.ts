import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type AdminPlan = {
  id: string
  name: string
  displayName: string
  price: number
  description: string | null
  trialDays: number
  isActive: boolean
  displayOrder: number
}

type UpdatePlanInput = {
  name: string
  displayName?: string
  price?: number
  description?: string | null
  trialDays?: number
  isActive?: boolean
}

async function fetchPlans(): Promise<AdminPlan[]> {
  const res = await fetch('/api/admin/plans')
  if (!res.ok) throw new Error('Falha ao carregar planos')
  return res.json()
}

async function updatePlan({ name, ...input }: UpdatePlanInput): Promise<AdminPlan> {
  const res = await fetch(`/api/admin/plans/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar plano')
  }
  return res.json()
}

export function usePlans() {
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: fetchPlans, staleTime: 30_000 })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  })
}
