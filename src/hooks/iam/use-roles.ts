import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type Role = {
  id: string
  tenantId: string
  name: string
  isDefault: boolean
  permissions: Record<string, string[]>
  createdAt: string
  updatedAt: string
  _count: { users: number }
}

type RoleInput = {
  name: string
  permissions: Record<string, string[]>
}

async function fetchRoles(): Promise<Role[]> {
  const res = await fetch('/api/iam/roles')
  if (!res.ok) throw new Error('Falha ao carregar cargos')
  return res.json()
}

async function createRole(input: RoleInput): Promise<Role> {
  const res = await fetch('/api/iam/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao criar cargo')
  }
  return res.json()
}

async function updateRole({ id, ...input }: RoleInput & { id: string }): Promise<Role> {
  const res = await fetch(`/api/iam/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar cargo')
  }
  return res.json()
}

async function deleteRole(id: string): Promise<void> {
  const res = await fetch(`/api/iam/roles/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao excluir cargo')
  }
}

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles, staleTime: 5 * 60 * 1000 })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}
