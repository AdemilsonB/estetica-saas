import type { ActivationStatus } from '@/domains/activation/types'

/**
 * Diz se o item de menu identificado por `key` deve exibir a bolinha âmbar de pendência.
 * Categorias vive dentro da página de Serviços — por isso "servicos" agrega os dois critérios.
 */
export function isSectionPending(status: ActivationStatus | undefined, key: string): boolean {
  if (!status) return false
  switch (key) {
    case 'servicos':
      return !status.categorias || !status.servicos
    case 'clientes':
      return !status.clientes
    case 'equipe':
      return !status.equipe
    case 'configuracoes':
      return !status.configuracoes.done
    default:
      return false
  }
}
