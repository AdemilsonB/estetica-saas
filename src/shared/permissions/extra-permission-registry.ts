import type { NavSection } from './nav-registry'

export const EXTRA_PERMISSION_REGISTRY: NavSection[] = [
  {
    key: 'comissoes',
    label: 'Comissões',
    description: 'Comissão de cada profissional por serviço',
    icon: 'Percent',
    href: '',
    actions: ['view', 'edit'],
    defaultPermissions: {
      MANAGER:      ['view', 'edit'],
      PROFESSIONAL: [],
      RECEPTIONIST: [],
    },
  },
  {
    key: 'descontos',
    label: 'Descontos',
    description: 'Tipos de desconto aplicáveis em atendimentos',
    icon: 'BadgePercent',
    href: '',
    actions: ['view', 'edit'],
    defaultPermissions: {
      MANAGER:      ['view', 'edit'],
      PROFESSIONAL: ['view', 'edit'],
      RECEPTIONIST: ['view'],
    },
  },
]

export function buildDefaultExtraPermissions(
  preset: 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST',
): Record<string, string[]> {
  return Object.fromEntries(
    EXTRA_PERMISSION_REGISTRY.map((s) => [s.key, [...s.defaultPermissions[preset]]]),
  )
}
