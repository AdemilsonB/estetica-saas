import { useQuery } from '@tanstack/react-query'

export type AdminTenant = {
  id: string
  name: string
  plan: string
  createdAt: string
  _count: { users: number }
}

async function fetchAdminTenants(): Promise<AdminTenant[]> {
  const res = await fetch('/api/admin/tenants')
  if (!res.ok) throw new Error('Falha ao carregar tenants')
  return res.json()
}

export function useAdminTenants() {
  return useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: fetchAdminTenants,
    staleTime: 60_000,
  })
}
