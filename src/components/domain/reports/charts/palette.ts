// Paleta dos gráficos de relatórios. Verde/vermelho ficam de fora de propósito:
// são reservados para indicadores de variação (▲/▼).
export const CHART_PALETTE = [
  '#0ea5e9', '#8b5cf6', '#f59e0b', '#14b8a6', '#d946ef', '#6366f1',
] as const

export const OTHERS_COLOR = '#94a3b8'

// Cor estável por entidade: o mesmo serviço/profissional recebe a mesma cor
// em todos os gráficos, em qualquer período.
export function stableColor(id: string | null): string {
  if (!id) return OTHERS_COLOR
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CHART_PALETTE[h % CHART_PALETTE.length]
}
