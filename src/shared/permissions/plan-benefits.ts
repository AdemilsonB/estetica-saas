import { CAPABILITY_REGISTRY, CAPABILITY_GROUPS } from './capability-registry'
import { LIMIT_REGISTRY } from './limit-registry'

const GROUP_ORDER: string[] = Object.values(CAPABILITY_GROUPS)

/**
 * Monta a lista canônica de benefícios de um plano a partir da config real
 * (capacidades habilitadas + limites), na ordem das categorias de exibição.
 * Função pura e client-safe: usada tanto pelo catálogo público (server) quanto
 * pelo preview do editor de planos no admin (client).
 */
export function buildPlanBenefits(input: {
  enabledCapabilityKeys: string[]
  limits: Record<string, number>
}): string[] {
  const enabled = new Set(input.enabledCapabilityKeys)
  const benefits: string[] = []

  for (const group of GROUP_ORDER) {
    // 1) Capacidades habilitadas e disponíveis (status 'ga') deste grupo.
    for (const cap of CAPABILITY_REGISTRY) {
      if (cap.group !== group) continue
      if (!enabled.has(cap.key)) continue
      if (cap.status !== 'ga') continue
      benefits.push(cap.benefitLabel)
    }
    // 2) Limites com valor > 0 deste grupo.
    for (const [key, meta] of Object.entries(LIMIT_REGISTRY)) {
      if (meta.group !== group) continue
      const value = input.limits[key]
      if (typeof value !== 'number' || value <= 0) continue
      benefits.push(meta.benefitLabel(value))
    }
  }

  return benefits
}
