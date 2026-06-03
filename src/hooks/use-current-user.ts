import { useQuery } from '@tanstack/react-query'
import type { UserRole } from '@prisma/client'

export type CurrentUser = {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
  permissions: string[]
  businessName: string
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch('/api/iam/me')
  if (res.status === 401) throw new Error('NAO_AUTENTICADO')
  if (!res.ok) throw new Error('Falha ao buscar usuario')
  return res.json()
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
