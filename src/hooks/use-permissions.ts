// src/hooks/use-permissions.ts
import { useCurrentUser } from './use-current-user'

const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: [
    'appointments:view', 'appointments:create', 'appointments:edit', 'appointments:delete',
    'customers:view', 'customers:create', 'customers:edit',
    'financial:view', 'financial:manage',
    'users:view', 'users:invite', 'users:manage',
    'services:view', 'services:manage',
  ],
  MANAGER: [
    'appointments:view', 'appointments:create', 'appointments:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'financial:view',
    'users:view',
    'services:view', 'services:manage',
  ],
  PROFESSIONAL: [
    'appointments:view', 'appointments:create',
    'customers:view',
    'services:view',
  ],
  RECEPTIONIST: [
    'appointments:view', 'appointments:create', 'appointments:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'services:view',
  ],
}

export function usePermissions() {
  const { data: user, isLoading } = useCurrentUser()

  function can(permission: string): boolean {
    if (!user) return false
    const rolePerms = ROLE_PERMISSIONS[user.role] ?? []
    const allPerms = new Set([...rolePerms, ...user.permissions])
    return allPerms.has(permission)
  }

  return { can, user, isLoading }
}
