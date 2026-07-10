import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EMPTY_ACTIVATION_SEEN, type ActivationSeenState } from '@/domains/activation/activation-seen'

type ConfigSectionKey = keyof ActivationSeenState['configuracoes']

type ActivationSeenStore = {
  seen: ActivationSeenState
  markEquipeSeen: () => void
  markConfigSectionSeen: (key: ConfigSectionKey) => void
}

/**
 * Persistido em localStorage (não é dado de negócio, é preferência local de UI —
 * "o usuário já viu essa pendência"). Uma vez marcado, a bolinha de pendência
 * correspondente some, mesmo que o dado real continue incompleto.
 */
export const useActivationSeenStore = create<ActivationSeenStore>()(
  persist(
    (set) => ({
      seen: EMPTY_ACTIVATION_SEEN,
      markEquipeSeen: () =>
        set((state) => ({ seen: { ...state.seen, equipe: true } })),
      markConfigSectionSeen: (key) =>
        set((state) => ({
          seen: { ...state.seen, configuracoes: { ...state.seen.configuracoes, [key]: true } },
        })),
    }),
    { name: 'agende:activation-seen' },
  ),
)
