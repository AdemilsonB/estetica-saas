export type ReportCapability = { capability: string; label: string; href: string }

export const REPORT_CAPABILITIES: ReportCapability[] = [
  { capability: 'report_visao_geral', label: 'Visão Geral', href: '/relatorios' },
  { capability: 'report_financeiro', label: 'Financeiro', href: '/relatorios/financeiro' },
  { capability: 'report_agendamentos', label: 'Agendamentos', href: '/relatorios/agendamentos' },
  { capability: 'report_clientes', label: 'Clientes', href: '/relatorios/clientes' },
]
