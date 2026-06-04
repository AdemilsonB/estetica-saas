import { UserRole } from '@prisma/client'
import { ForbiddenError } from '@/shared/errors'
import type { SessionContext } from '@/shared/types/auth'
import type { NavAction } from '@/shared/permissions/nav-registry'
import { LEGACY_PERMISSION_MAP } from './permissions-legacy'

export const PERMISSIONS = {
  appointments: {
    view:   'appointments:view',
    create: 'appointments:create',
    edit:   'appointments:edit',
    delete: 'appointments:delete',
  },
  customers: {
    view:   'customers:view',
    create: 'customers:create',
    edit:   'customers:edit',
  },
  financial: {
    view:   'financial:view',
    manage: 'financial:manage',
  },
  users: {
    view:   'users:view',
    invite: 'users:invite',
    manage: 'users:manage',
  },
  services: {
    view:   'services:view',
    manage: 'services:manage',
  },
  settings: {
    view:   'settings:view',
    manage: 'settings:manage',
  },
} as const

// Mantido para compatibilidade com iam.repository.ts e outros
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.OWNER]: Object.values(PERMISSIONS).flatMap((g) => Object.values(g)),
  [UserRole.MANAGER]: [
    PERMISSIONS.appointments.view, PERMISSIONS.appointments.create, PERMISSIONS.appointments.edit,
    PERMISSIONS.customers.view, PERMISSIONS.customers.create, PERMISSIONS.customers.edit,
    PERMISSIONS.financial.view, PERMISSIONS.services.view, PERMISSIONS.services.manage,
    PERMISSIONS.users.view, PERMISSIONS.settings.view, PERMISSIONS.settings.manage,
  ],
  [UserRole.PROFESSIONAL]: [
    PERMISSIONS.appointments.view, PERMISSIONS.appointments.create,
    PERMISSIONS.customers.view, PERMISSIONS.services.view,
  ],
  [UserRole.RECEPTIONIST]: [
    PERMISSIONS.appointments.view, PERMISSIONS.appointments.create, PERMISSIONS.appointments.edit,
    PERMISSIONS.customers.view, PERMISSIONS.customers.create, PERMISSIONS.customers.edit,
    PERMISSIONS.services.view,
  ],
}

/**
 * Suporta duas assinaturas:
 * Nova:    ensurePermission(session, 'agenda', 'view')
 * Legacy:  ensurePermission(session, 'appointments:view')
 */
export function ensurePermission(
  session: SessionContext,
  sectionKeyOrLegacy: string,
  action?: NavAction,
): void {
  if (session.isOwner) return

  if (action !== undefined) {
    // Nova assinatura: verifica sectionKey + action
    const allowed = session.permissions[sectionKeyOrLegacy] ?? []
    if (!allowed.includes(action)) {
      throw new ForbiddenError('Permissao insuficiente para esta operacao.')
    }
  } else {
    // Legacy: mapeia 'domain:action' para novo formato
    const mappings = LEGACY_PERMISSION_MAP[sectionKeyOrLegacy]
    if (!mappings || mappings.length === 0) {
      throw new ForbiddenError('Permissao insuficiente para esta operacao.')
    }
    const hasAll = mappings.every(
      ({ key, action: act }) => session.permissions[key]?.includes(act),
    )
    if (!hasAll) {
      throw new ForbiddenError('Permissao insuficiente para esta operacao.')
    }
  }
}
