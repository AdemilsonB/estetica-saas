import type { ActivationStatus } from '@/domains/activation/types'

export type ActivationStepKey = 'categorias' | 'servicos' | 'clientes' | 'equipe' | 'configuracoes'

export interface ActivationStep {
  key: ActivationStepKey
  label: string
  href: string
  done: boolean
}

/** Monta os 5 passos do checklist na ordem canônica da spec. */
export function buildActivationSteps(status: ActivationStatus): ActivationStep[] {
  return [
    { key: 'categorias', label: 'Crie categorias de serviço', href: '/servicos', done: status.categorias },
    { key: 'servicos', label: 'Cadastre seus serviços', href: '/servicos', done: status.servicos },
    { key: 'clientes', label: 'Adicione seus clientes', href: '/clientes', done: status.clientes },
    { key: 'equipe', label: 'Configure cargos da equipe', href: '/equipe', done: status.equipe },
    { key: 'configuracoes', label: 'Complete os dados do negócio', href: '/configuracoes', done: status.configuracoes.done },
  ]
}

/** Percentual (0-100) de passos concluídos, arredondado. */
export function activationProgressPercent(status: ActivationStatus): number {
  const steps = buildActivationSteps(status)
  const done = steps.filter((s) => s.done).length
  return Math.round((done / steps.length) * 100)
}

/**
 * Regra de exibição do card de progresso:
 * - esconde se não há pendência;
 * - mostra se há pendência e não foi dispensado;
 * - se dispensado, só reaparece enquanto Clientes OU Serviços continuarem pendentes.
 */
export function shouldShowActivationCard(input: { status: ActivationStatus; dismissed: boolean }): boolean {
  const { status, dismissed } = input
  const hasPending = buildActivationSteps(status).some((s) => !s.done)
  if (!hasPending) return false
  const criticalPending = !status.clientes || !status.servicos
  return !dismissed || criticalPending
}
