import { useActivationStatus } from './use-activation-status'
import { useActivationSeenStore } from '@/stores/activation-seen.store'
import { mergeActivationStatusWithSeen } from '@/domains/activation/activation-seen'
import type { ActivationStatus } from '@/domains/activation/types'

/**
 * Status de ativação "efetivo": status real + seções já vistas pelo usuário
 * (ver `activation-seen.store`). Use este hook para tudo que decide se mostra
 * bolinha/checklist pendente (nav, card de progresso, Configurações).
 * Para exibir o dado real (ex: badge "Completo"/"Pendente" dentro do card),
 * use `useActivationStatus` diretamente.
 */
export function useEffectiveActivationStatus() {
  const query = useActivationStatus()
  const seen = useActivationSeenStore((s) => s.seen)

  const data: ActivationStatus | undefined = query.data
    ? mergeActivationStatusWithSeen(query.data, seen)
    : undefined

  return { ...query, data, rawData: query.data }
}
