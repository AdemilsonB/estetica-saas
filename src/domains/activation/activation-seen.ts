import type { ActivationStatus } from './types'

export interface ActivationSeenState {
  equipe: boolean
  configuracoes: {
    dadosNegocio: boolean
    horarios: boolean
    branding: boolean
    whatsapp: boolean
  }
}

export const EMPTY_ACTIVATION_SEEN: ActivationSeenState = {
  equipe: false,
  configuracoes: {
    dadosNegocio: false,
    horarios: false,
    branding: false,
    whatsapp: false,
  },
}

/**
 * Combina o status real (vindo do banco) com o que o usuário já "viu" (persistido
 * localmente). Uma vez visto, a seção deixa de contar como pendente para fins de
 * bolinha/checklist — mesmo que o dado real ainda esteja incompleto.
 * Categorias/Serviços/Clientes não têm "seen": permanecem 100% orientados a dado real.
 */
export function mergeActivationStatusWithSeen(
  status: ActivationStatus,
  seen: ActivationSeenState,
): ActivationStatus {
  const configuracoes = {
    dadosNegocio: status.configuracoes.dadosNegocio || seen.configuracoes.dadosNegocio,
    horarios: status.configuracoes.horarios || seen.configuracoes.horarios,
    branding: status.configuracoes.branding || seen.configuracoes.branding,
    whatsapp: status.configuracoes.whatsapp || seen.configuracoes.whatsapp,
  }

  return {
    ...status,
    equipe: status.equipe || seen.equipe,
    configuracoes: {
      ...configuracoes,
      done: configuracoes.dadosNegocio && configuracoes.horarios && configuracoes.branding && configuracoes.whatsapp,
    },
  }
}
