import { useCurrentUser } from './use-current-user'
import type { NavAction } from '@/shared/permissions/nav-registry'

export function usePermissions() {
  const { data: user, isLoading } = useCurrentUser()

  function can(sectionKey: string, action: NavAction): boolean {
    if (!user) return false
    if (user.isOwner) return true
    return user.permissions[sectionKey]?.includes(action) ?? false
  }

  function canAccess(sectionKey: string): boolean {
    return can(sectionKey, 'view')
  }

  return { can, canAccess, user, isLoading }
}
