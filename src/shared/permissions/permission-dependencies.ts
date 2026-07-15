import { NAV_REGISTRY, type NavAction } from './nav-registry'
import { EXTRA_PERMISSION_REGISTRY } from './extra-permission-registry'

export type PermissionDependency = { section: string; action: NavAction }

/**
 * Permissões que são pré-requisito silencioso de outra: a tela/API do fluxo
 * busca dados de outro módulo mesmo que a matriz de cargos nunca deixe isso
 * explícito (ex: criar agendamento busca cliente e serviço). Sem isso, um
 * cargo pode nascer "coerente" na matriz e ainda assim travar o profissional
 * no meio do atendimento. Ver docs/decisions.md — ADR consolidação RBAC.
 */
export const PERMISSION_DEPENDENCIES: Record<string, PermissionDependency[]> = {
  'agenda:create': [
    { section: 'clientes', action: 'view' },
    { section: 'servicos', action: 'view' },
  ],
  'agenda:edit': [
    { section: 'clientes', action: 'view' },
    { section: 'servicos', action: 'view' },
  ],
  // Registrar pagamento (checkout) lista os tipos de desconto cadastrados.
  'financeiro:edit': [
    { section: 'descontos', action: 'view' },
  ],
}

/**
 * Expande um objeto de permissões adicionando as dependências implícitas
 * ausentes. Idempotente e sem efeitos colaterais — quem chama decide o que
 * fazer com `added` (persistir, avisar o usuário, etc).
 */
export function expandPermissionsWithDependencies(
  permissions: Record<string, string[]>,
): { permissions: Record<string, string[]>; added: PermissionDependency[] } {
  const result: Record<string, string[]> = Object.fromEntries(
    Object.entries(permissions).map(([key, actions]) => [key, [...actions]]),
  )
  const added: PermissionDependency[] = []

  let changed = true
  while (changed) {
    changed = false
    for (const [sectionKey, actions] of Object.entries(result)) {
      for (const action of actions) {
        const deps = PERMISSION_DEPENDENCIES[`${sectionKey}:${action}`]
        if (!deps) continue
        for (const dep of deps) {
          const current = result[dep.section] ?? []
          if (!current.includes(dep.action)) {
            result[dep.section] = [...current, dep.action]
            added.push(dep)
            changed = true
          }
        }
      }
    }
  }

  return { permissions: result, added }
}

/** Diferença entre dois objetos de permissões — usado para avisar o dono no editor de cargo. */
export function diffAddedPermissions(
  before: Record<string, string[]>,
  after: Record<string, string[]>,
): PermissionDependency[] {
  const added: PermissionDependency[] = []
  for (const [section, actions] of Object.entries(after)) {
    const prevActions = before[section] ?? []
    for (const action of actions) {
      if (!prevActions.includes(action)) {
        added.push({ section, action: action as NavAction })
      }
    }
  }
  return added
}

const ACTION_LABELS: Record<NavAction, string> = {
  view: 'visualizar',
  create: 'criar',
  edit: 'editar',
  delete: 'excluir',
  view_all: 'ver de todos os profissionais',
}

export function describeDependency(dep: PermissionDependency): string {
  const section = [...NAV_REGISTRY, ...EXTRA_PERMISSION_REGISTRY].find((s) => s.key === dep.section)
  const label = section?.label ?? dep.section
  return `${label} (${ACTION_LABELS[dep.action]})`
}
