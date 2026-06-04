export type NavAction = 'view' | 'create' | 'edit' | 'delete'

export type NavSection = {
  key: string
  label: string
  icon: string
  href: string
  actions: NavAction[]
  defaultPermissions: {
    MANAGER: NavAction[]
    PROFESSIONAL: NavAction[]
    RECEPTIONIST: NavAction[]
  }
}

export const NAV_REGISTRY: NavSection[] = [
  {
    key: 'agenda',
    label: 'Agenda',
    icon: 'CalendarDays',
    href: '/agenda',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete'],
      PROFESSIONAL: ['view', 'create'],
      RECEPTIONIST: ['view', 'create', 'edit'],
    },
  },
  {
    key: 'servicos',
    label: 'Serviços',
    icon: 'Scissors',
    href: '/servicos',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete'],
      PROFESSIONAL: ['view'],
      RECEPTIONIST: ['view'],
    },
  },
  {
    key: 'clientes',
    label: 'Clientes',
    icon: 'Users',
    href: '/clientes',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit'],
      PROFESSIONAL: ['view'],
      RECEPTIONIST: ['view', 'create', 'edit'],
    },
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    icon: 'CreditCard',
    href: '/financeiro',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'relatorios',
    label: 'Relatórios',
    icon: 'BarChart2',
    href: '/relatorios',
    actions: ['view'],
    defaultPermissions: {
      MANAGER:      ['view'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'equipe',
    label: 'Equipe',
    icon: 'UserCog',
    href: '/equipe',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'configuracoes',
    label: 'Config.',
    icon: 'Settings',
    href: '/configuracoes',
    actions: ['view', 'edit'],
    defaultPermissions: {
      MANAGER:      ['view', 'edit'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
]

export function buildOwnerPermissions(): Record<string, string[]> {
  return Object.fromEntries(
    NAV_REGISTRY.map((s) => [s.key, [...s.actions]])
  )
}

export function buildDefaultRolePermissions(
  preset: 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'
): Record<string, string[]> {
  return Object.fromEntries(
    NAV_REGISTRY.map((s) => [s.key, [...s.defaultPermissions[preset]]])
  )
}
