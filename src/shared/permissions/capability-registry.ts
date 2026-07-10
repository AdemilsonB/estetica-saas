import { NAV_REGISTRY } from './nav-registry'

export type CapabilityCategory = 'nav' | 'capability' | 'report'
export type CapabilityStatus = 'ga' | 'soon'

export type Capability = {
  key: string
  label: string
  category: CapabilityCategory
  essential: boolean
  benefitLabel: string
  status: CapabilityStatus
  group: string
}

// Grupos de exibição usados no admin (features e limites compartilham os mesmos rótulos).
export const CAPABILITY_GROUPS = {
  ACESSO: 'Acesso & Equipe',
  OPERACAO: 'Operação',
  CATALOGO: 'Catálogo & Estoque',
  COMUNICACAO: 'Comunicação',
  CLIENTES: 'Clientes',
  RELATORIOS: 'Relatórios',
} as const

// Metadados de gating por chave de nav. As essenciais nunca podem ser desligadas.
// `label` é opcional e sobrescreve o label vindo do NAV_REGISTRY (útil quando a sidebar
// usa uma abreviação otimizada para espaço, mas o admin precisa do rótulo completo).
const NAV_META: Record<string, { label?: string; essential: boolean; benefitLabel: string; group: string }> = {
  agenda:        { essential: true,  benefitLabel: 'Agenda completa',            group: CAPABILITY_GROUPS.OPERACAO },
  servicos:      { essential: true,  benefitLabel: 'Serviços, pacotes e promoções', group: CAPABILITY_GROUPS.OPERACAO },
  clientes:      { essential: true,  benefitLabel: 'CRM de clientes',            group: CAPABILITY_GROUPS.CLIENTES },
  equipe:        { essential: true,  benefitLabel: 'Gestão de equipe',           group: CAPABILITY_GROUPS.ACESSO },
  configuracoes: { label: 'Configurações', essential: true,  benefitLabel: 'Configurações',  group: CAPABILITY_GROUPS.ACESSO },
  produtos:      { essential: false, benefitLabel: 'Estoque de produtos',        group: CAPABILITY_GROUPS.CATALOGO },
  financeiro:    { essential: false, benefitLabel: 'Financeiro e caixa',         group: CAPABILITY_GROUPS.OPERACAO },
  relatorios:    { essential: false, benefitLabel: 'Relatórios',                 group: CAPABILITY_GROUPS.RELATORIOS },
}

// Capacidades (não-nav) gateáveis por plano.
const CAPABILITY_ENTRIES: Capability[] = [
  { key: 'whatsapp_basic',   label: 'WhatsApp Básico',    category: 'capability', essential: false, benefitLabel: 'WhatsApp automático',            status: 'ga', group: CAPABILITY_GROUPS.COMUNICACAO },
  { key: 'whatsapp_premium', label: 'WhatsApp Premium',   category: 'capability', essential: false, benefitLabel: 'WhatsApp premium (chatbot)',     status: 'ga', group: CAPABILITY_GROUPS.COMUNICACAO },
  { key: 'campaigns',        label: 'Campanhas',          category: 'capability', essential: false, benefitLabel: 'Campanhas de marketing',         status: 'ga', group: CAPABILITY_GROUPS.COMUNICACAO },
  { key: 'reports_advanced', label: 'Relatórios Avançados', category: 'capability', essential: false, benefitLabel: 'Relatórios avançados',        status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
  { key: 'comissoes', label: 'Comissões da equipe', category: 'capability', essential: false, benefitLabel: 'Comissão por profissional e por cargo', status: 'ga', group: CAPABILITY_GROUPS.ACESSO },
  { key: 'descontos', label: 'Descontos configuráveis', category: 'capability', essential: false, benefitLabel: 'Tipos de desconto no atendimento', status: 'ga', group: CAPABILITY_GROUPS.OPERACAO },
]

// Seções de navegação: derivadas do NAV_REGISTRY (chave/label) + metadados de gating.
const NAV_ENTRIES: Capability[] = NAV_REGISTRY.map((s) => {
  const meta = NAV_META[s.key] ?? { essential: false, benefitLabel: s.label, group: CAPABILITY_GROUPS.OPERACAO }
  return {
    key: s.key,
    label: meta.label ?? s.label,
    category: 'nav' as const,
    essential: meta.essential,
    benefitLabel: meta.benefitLabel,
    status: 'ga' as const,
    group: meta.group,
  }
})

const REPORT_ENTRIES: Capability[] = [
  { key: 'report_visao_geral',  label: 'Relatório: Visão Geral',  category: 'report', essential: false, benefitLabel: 'Relatório de visão geral',   status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
  { key: 'report_financeiro',   label: 'Relatório: Financeiro',   category: 'report', essential: false, benefitLabel: 'Relatório financeiro',        status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
  { key: 'report_agendamentos', label: 'Relatório: Agendamentos', category: 'report', essential: false, benefitLabel: 'Relatório de agendamentos',   status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
  { key: 'report_clientes',     label: 'Relatório: Clientes',     category: 'report', essential: false, benefitLabel: 'Relatório de clientes',        status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
]

export const CAPABILITY_REGISTRY: Capability[] = [...NAV_ENTRIES, ...CAPABILITY_ENTRIES, ...REPORT_ENTRIES]

export const ESSENTIAL_KEYS: string[] = CAPABILITY_REGISTRY.filter((c) => c.essential).map((c) => c.key)

export function getCapability(key: string): Capability | undefined {
  return CAPABILITY_REGISTRY.find((c) => c.key === key)
}

export function isEssential(key: string): boolean {
  return getCapability(key)?.essential ?? false
}

export function getGateableCapabilities(): Capability[] {
  return CAPABILITY_REGISTRY.filter((c) => !c.essential && c.status === 'ga')
}
