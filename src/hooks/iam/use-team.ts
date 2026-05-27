// src/hooks/iam/use-team.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type UserRole = 'OWNER' | 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'

export type TeamMember = {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

export type TeamInvite = {
  id: string
  email: string
  role: UserRole
  status: 'PENDING' | 'ACCEPTED'
  expiresAt: string
  createdAt: string
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch('/api/iam/users')
  if (!res.ok) throw new Error('Falha ao carregar equipe')
  return res.json()
}

async function fetchInvites(): Promise<TeamInvite[]> {
  const res = await fetch('/api/iam/invites')
  if (!res.ok) throw new Error('Falha ao carregar convites')
  return res.json()
}

async function createInvite(input: {
  email: string
  role: Exclude<UserRole, 'OWNER'>
}): Promise<TeamInvite> {
  const res = await fetch('/api/iam/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao enviar convite')
  }
  return res.json()
}

async function updateMemberRole(input: {
  userId: string
  role: Exclude<UserRole, 'OWNER'>
}): Promise<TeamMember> {
  const res = await fetch(`/api/iam/users/${input.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: input.role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar papel')
  }
  return res.json()
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: fetchTeamMembers,
    staleTime: 60 * 1000,
  })
}

export function useTeamInvites() {
  return useQuery({
    queryKey: ['team-invites'],
    queryFn: fetchInvites,
    staleTime: 60 * 1000,
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites'] })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMemberRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}
