import type { ActivationCounts, ActivationStatus } from './types'

function filled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Calcula o status de ativação a partir das contagens/dados brutos.
 * Função pura — sem acesso a banco, sem efeitos colaterais.
 */
export function computeActivationStatus(counts: ActivationCounts): ActivationStatus {
  const dadosNegocio = filled(counts.tenant.phone) && filled(counts.tenant.address)
  const horarios = counts.tenant.businessHours != null
  const branding = filled(counts.logoUrl)
  const whatsapp = counts.tenant.evolutionConnected === true

  return {
    categorias: counts.activeCategoryCount > 0,
    servicos: counts.activeServiceCount > 0,
    clientes: counts.activeCustomerCount > 0,
    equipe: counts.customRoleCount > 0,
    configuracoes: {
      dadosNegocio,
      horarios,
      branding,
      whatsapp,
      done: dadosNegocio && horarios && branding && whatsapp,
    },
  }
}
