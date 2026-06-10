import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type UserRole = 'OWNER' | 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'

export type MemberService = {
  id: string
  name: string
}

export type TeamMember = {
  id: string
  name: string
  email: string
  role: UserRole
  isOwner: boolean
  roleId: string | null
  roleName: string
  avatarUrl: string | null
  services: MemberService[]
  createdAt: string
}

export type TeamInvite = {
  id: string
  email: string
  role: UserRole
  roleId: string | null
  status: 'PENDING' | 'ACCEPTED'
  expiresAt: string
  createdAt: string
}

export type ProfessionalsByServiceResult = {
  professionals: TeamMember[]
  filtered: boolean
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch('/api/iam/users')
  if (!res.ok) throw new Error('Falha ao carregar equipe')
  return res.json()
}

async function fetchProfessionalsByService(
  serviceId: string,
): Promise<ProfessionalsByServiceResult> {
  const res = await fetch(`/api/iam/users?serviceId=${serviceId}`)
  if (!res.ok) throw new Error('Falha ao carregar profissionais')
  return res.json()
}

async function fetchInvites(): Promise<TeamInvite[]> {
  const res = await fetch('/api/iam/invites')
  if (!res.ok) throw new Error('Falha ao carregar convites')
  return res.json()
}

async function createInvite(input: { email: string; roleId: string }): Promise<TeamInvite> {
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

async function updateMemberRole(input: { userId: string; roleId: string }): Promise<TeamMember> {
  const res = await fetch(`/api/iam/users/${input.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: input.roleId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar cargo')
  }
  return res.json()
}

async function updateMemberProfile(input: {
  userId: string
  name?: string
  email?: string
}): Promise<TeamMember> {
  const res = await fetch(`/api/iam/users/${input.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, email: input.email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar membro')
  }
  return res.json()
}

async function uploadAvatar(input: {
  userId: string
  file: File
}): Promise<{ avatarUrl: string }> {
  const formData = new FormData()
  formData.append('file', input.file)
  const res = await fetch(`/api/iam/users/${input.userId}/avatar`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao fazer upload da foto')
  }
  return res.json()
}

async function cancelInvite(inviteId: string): Promise<void> {
  const res = await fetch(`/api/iam/invites/${inviteId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao cancelar convite')
  }
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: fetchTeamMembers,
    staleTime: 60 * 1000,
  })
}

export function useProfessionalsByService(serviceId: string | null) {
  return useQuery({
    queryKey: ['professionals-by-service', serviceId],
    queryFn: () => fetchProfessionalsByService(serviceId!),
    enabled: !!serviceId,
    staleTime: 30 * 1000,
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

export function useCancelInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelInvite,
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

export function useUpdateMemberProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMemberProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
    },
  })
}
