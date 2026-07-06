import { useQuery } from '@tanstack/react-query'
import type { NavSection } from '@/shared/permissions/nav-registry'

export type NavSectionWithLock = NavSection & {
  locked: boolean
  requiredPlan: string | null
  requiredPlanLabel: string | null
}

async function fetchNavSections(): Promise<NavSectionWithLock[]> {
  const res = await fetch('/api/iam/nav-sections')
  if (!res.ok) throw new Error('Falha ao carregar seções')
  return res.json()
}

export function useNavSections() {
  return useQuery({
    queryKey: ['nav-sections'],
    queryFn: fetchNavSections,
    staleTime: 5 * 60 * 1000,
  })
}
