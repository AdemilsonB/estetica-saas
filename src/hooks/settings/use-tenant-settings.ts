import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type TenantSettings = {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  publicPageEnabled: boolean
}

export type UpdateTenantInput = {
  name?: string
  phone?: string | null
  address?: string | null
  publicPageEnabled?: boolean
}

async function fetchTenantSettings(): Promise<TenantSettings> {
  const res = await fetch('/api/iam/tenant')
  if (!res.ok) throw new Error('Falha ao carregar configuracoes do negocio')
  return res.json()
}

async function updateTenantSettings(input: UpdateTenantInput): Promise<TenantSettings> {
  const res = await fetch('/api/iam/tenant', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao salvar configuracoes')
  return res.json()
}

export function useTenantSettings() {
  return useQuery({
    queryKey: ['tenant-settings'],
    queryFn: fetchTenantSettings,
    staleTime: 60 * 1000,
  })
}

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] })
    },
  })
}
