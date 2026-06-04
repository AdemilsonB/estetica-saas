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
    // permissions é um Record<string, string[]>, extrair todos os values
    const permissionsArray = Object.values(user.permissions).flat()
    const allPerms = new Set(permissionsArray)
    return allPerms.has(permission)
  }

  return { can, user, isLoading }
}
