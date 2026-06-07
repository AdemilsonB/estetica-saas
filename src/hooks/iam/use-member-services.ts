import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type MemberService = {
  id: string
  name: string
}

async function fetchMemberServices(userId: string): Promise<MemberService[]> {
  const res = await fetch(`/api/iam/users/${userId}/services`)
  if (!res.ok) throw new Error('Falha ao carregar serviços do membro')
  return res.json()
}

async function setMemberServices(input: {
  userId: string
  serviceIds: string[]
}): Promise<MemberService[]> {
  const res = await fetch(`/api/iam/users/${input.userId}/services`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceIds: input.serviceIds }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao salvar serviços')
  }
  return res.json()
}

export function useGetMemberServices(userId: string | null) {
  return useQuery({
    queryKey: ['member-services', userId],
    queryFn: () => fetchMemberServices(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

export function useSetMemberServices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setMemberServices,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-services', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}
