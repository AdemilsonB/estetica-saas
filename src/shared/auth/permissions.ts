import { UserRole } from '@prisma/client'
import { ForbiddenError } from '@/shared/errors'
import type { SessionContext } from '@/shared/types/auth'
import type { NavAction } from '@/shared/permissions/nav-registry'

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

const LEGACY_PERMISSION_MAP: Record<string, { key: string; action: string }[]> = {
  'appointments:view':   [{ key: 'agenda',        action: 'view'   }],
  'appointments:create': [{ key: 'agenda',        action: 'create' }],
  'appointments:edit':   [{ key: 'agenda',        action: 'edit'   }],
  'appointments:delete': [{ key: 'agenda',        action: 'delete' }],
  'customers:view':      [{ key: 'clientes',      action: 'view'   }],
  'customers:create':    [{ key: 'clientes',      action: 'create' }],
  'customers:edit':      [{ key: 'clientes',      action: 'edit'   }],
  'financial:view':      [{ key: 'financeiro',    action: 'view'   }],
  'financial:manage':    [{ key: 'financeiro',    action: 'edit'   }],
  'services:view':       [{ key: 'servicos',      action: 'view'   }],
  'services:manage':     [{ key: 'servicos',      action: 'edit'   }],
  'users:view':          [{ key: 'equipe',        action: 'view'   }],
  'users:invite':        [{ key: 'equipe',        action: 'create' }],
  'users:manage':        [{ key: 'equipe',        action: 'edit'   }],
  'settings:view':       [{ key: 'configuracoes', action: 'view'   }],
  'settings:manage':     [{ key: 'configuracoes', action: 'edit'   }],
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
    const allowed = session.permissions[sectionKeyOrLegacy] ?? []
    if (!allowed.includes(action)) {
      throw new ForbiddenError('Permissao insuficiente para esta operacao.')
    }
  } else {
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
