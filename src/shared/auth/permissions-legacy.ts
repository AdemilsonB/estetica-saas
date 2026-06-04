export const LEGACY_PERMISSION_MAP: Record<string, { key: string; action: string }[]> = {
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

// Mapeamento para o buildRolePermissions na migração
const HARDCODED_ROLE_PERMS: Record<string, string[]> = {
  OWNER: [
    'appointments:view', 'appointments:create', 'appointments:edit', 'appointments:delete',
    'customers:view', 'customers:create', 'customers:edit',
    'financial:view', 'financial:manage',
    'users:view', 'users:invite', 'users:manage',
    'services:view', 'services:manage',
    'settings:view', 'settings:manage',
  ],
  MANAGER: [
    'appointments:view', 'appointments:create', 'appointments:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'financial:view', 'services:view', 'services:manage',
    'users:view', 'settings:view', 'settings:manage',
  ],
  PROFESSIONAL: ['appointments:view', 'appointments:create', 'customers:view', 'services:view'],
  RECEPTIONIST: [
    'appointments:view', 'appointments:create', 'appointments:edit',
    'customers:view', 'customers:create', 'customers:edit', 'services:view',
  ],
}

export function legacyRoleToPermissions(role: string): Record<string, string[]> {
  const oldPerms = HARDCODED_ROLE_PERMS[role] ?? []
  const result: Record<string, string[]> = {}
  for (const perm of oldPerms) {
    const mappings = LEGACY_PERMISSION_MAP[perm] ?? []
    for (const { key, action } of mappings) {
      if (!result[key]) result[key] = []
      if (!result[key].includes(action)) result[key].push(action)
    }
  }
  return result
}
