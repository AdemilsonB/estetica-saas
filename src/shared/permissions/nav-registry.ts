export type NavAction = 'view' | 'create' | 'edit' | 'delete' | 'view_all'

export type NavSection = {
  key: string
  label: string
  description: string
  icon: string
  href: string
  actions: NavAction[]
  filterLabel?: string
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
    description: 'Atendimentos e encaixes',
    icon: 'CalendarDays',
    href: '/agenda',
    actions: ['view', 'create', 'edit', 'delete', 'view_all'],
    filterLabel: 'Ver atendimentos de outros profissionais',
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete', 'view_all'],
      PROFESSIONAL: ['view', 'create'],
      RECEPTIONIST: ['view', 'create', 'edit'],
    },
  },
  {
    key: 'servicos',
    label: 'Serviços',
    description: 'Serviços, Pacotes e Promoções',
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
    key: 'produtos',
    label: 'Produtos',
    description: 'Catálogo e estoque',
    icon: 'ShoppingBag',
    href: '/produtos',
    actions: ['view', 'create', 'edit', 'delete'],
    defaultPermissions: {
      MANAGER:      ['view', 'create', 'edit', 'delete'],
      PROFESSIONAL: ['view'],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'clientes',
    label: 'Clientes',
    description: 'CRM e recorrência',
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
    description: 'Receitas e caixa',
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
    description: 'Análises e exportações',
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
    description: 'Usuários e permissões',
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
    description: 'Configurações',
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
