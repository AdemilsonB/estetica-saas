import { useQuery } from '@tanstack/react-query'
import type { NavSection } from '@/shared/permissions/nav-registry'

export type ExtraPermissionWithLock = NavSection & {
  locked: boolean
  requiredPlan: string | null
  requiredPlanLabel: string | null
}

async function fetchExtraPermissions(): Promise<ExtraPermissionWithLock[]> {
  const res = await fetch('/api/iam/extra-permissions')
  if (!res.ok) throw new Error('Falha ao carregar permissões extras')
  return res.json()
}

export function useExtraPermissions() {
  return useQuery({
    queryKey: ['extra-permissions'],
    queryFn: fetchExtraPermissions,
    staleTime: 5 * 60 * 1000,
  })
}
