/** Detalhe do status da seção Configurações (usado nas bolinhas por card). */
export interface ActivationConfigStatus {
  /** phone + address preenchidos */
  dadosNegocio: boolean
  /** businessHours preenchido */
  horarios: boolean
  /** logoUrl (BrandingConfig) preenchido */
  branding: boolean
  /** WhatsApp (Evolution) conectado */
  whatsapp: boolean
  /** true quando todos os 4 acima estão concluídos */
  done: boolean
}

/** Status de ativação por módulo. `true` = concluído; `false` = pendente. */
export interface ActivationStatus {
  categorias: boolean
  servicos: boolean
  clientes: boolean
  equipe: boolean
  configuracoes: ActivationConfigStatus
}

/** Dados brutos lidos do banco para calcular o status (sem regra de negócio). */
export interface ActivationCounts {
  activeCategoryCount: number
  activeServiceCount: number
  activeCustomerCount: number
  customRoleCount: number
  tenant: {
    phone: string | null
    address: string | null
    businessHours: unknown | null
    evolutionConnected: boolean
  }
  logoUrl: string | null
}
