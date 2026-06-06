import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type SchedulingPolicy = {
  id: string
  tenantId: string
  allowPublicBooking: boolean
  paddingMinutes: number
  minAdvanceMinutes: number
  maxAdvanceDays: number
}

export type UpdateSchedulingPolicyInput = {
  allowPublicBooking?: boolean
  paddingMinutes?: number
  minAdvanceMinutes?: number
  maxAdvanceDays?: number
}

async function fetchSchedulingPolicy(): Promise<SchedulingPolicy> {
  const res = await fetch('/api/scheduling/policy')
  if (!res.ok) throw new Error('Falha ao carregar política de agendamento')
  return res.json()
}

async function updateSchedulingPolicy(
  input: UpdateSchedulingPolicyInput,
): Promise<SchedulingPolicy> {
  const res = await fetch('/api/scheduling/policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao salvar política de agendamento')
  return res.json()
}

export function useSchedulingPolicy() {
  return useQuery({
    queryKey: ['scheduling-policy'],
    queryFn: fetchSchedulingPolicy,
    staleTime: 60 * 1000,
  })
}

export function useUpdateSchedulingPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSchedulingPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling-policy'] })
    },
  })
}
