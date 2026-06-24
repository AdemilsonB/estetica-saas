import { useQuery } from '@tanstack/react-query'

export type CurrentUser = {
  id: string
  tenantId: string
  email: string
  name: string
  role: 'OWNER' | 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'
  isOwner: boolean
  roleId: string | null
  roleName: string
  permissions: Record<string, string[]>
  businessName: string
  tenantSlug: string
  avatarUrl: string | null
  avatarCropX: number | null
  avatarCropY: number | null
  avatarCropZoom: number | null
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
