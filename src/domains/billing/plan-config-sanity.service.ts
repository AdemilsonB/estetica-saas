import { prisma } from '@/shared/database/prisma'
import { getPlanOrder } from '@/domains/billing/plan-order'
import { LIMIT_REGISTRY, type LimitKey } from '@/shared/permissions/limit-registry'
import { CAPABILITY_REGISTRY } from '@/shared/permissions/capability-registry'

export type PlanConfigWarning = { severity: 'warning'; plan: string; message: string }

/**
 * Avisos não-bloqueantes sobre a configuração dos planos, para o admin conferir
 * consistência. Read-only: monotonicidade precisa comparar planos entre si, e o
 * editor carrega um plano por vez. Não impede salvar — só sinaliza.
 */
export async function getPlanConfigWarnings(): Promise<PlanConfigWarning[]> {
  const [order, limits, features] = await Promise.all([
    getPlanOrder(),
    prisma.planLimitConfig.findMany({ select: { plan: true, limitKey: true, value: true } }),
    prisma.planFeatureConfig.findMany({ select: { plan: true, sectionKey: true, enabled: true } }),
  ])

  const warnings: PlanConfigWarning[] = []

  // 1. Monotonicidade: plano de ordem maior não deveria ter limite menor que um de ordem menor.
  const limitByPlanKey = new Map<string, number>()
  for (const l of limits) limitByPlanKey.set(`${l.plan}::${l.limitKey}`, l.value)

  const limitKeys = Object.keys(LIMIT_REGISTRY) as LimitKey[]
  for (const limitKey of limitKeys) {
    const meta = LIMIT_REGISTRY[limitKey]
    for (let i = 1; i < order.length; i++) {
      const higher = order[i]
      const lower = order[i - 1]
      const higherVal = limitByPlanKey.get(`${higher}::${limitKey}`)
      const lowerVal = limitByPlanKey.get(`${lower}::${limitKey}`)
      if (higherVal == null || lowerVal == null) continue
      // "ilimitado" é sempre >= qualquer finito — não conta como violação.
      const higherUnlimited = higherVal >= meta.unlimitedThreshold
      if (higherUnlimited) continue
      if (higherVal < lowerVal) {
        warnings.push({
          severity: 'warning',
          plan: higher,
          message: `"${meta.label}" no ${higher} (${higherVal}) é menor que no ${lower} (${lowerVal}).`,
        })
      }
    }
  }

  // 2. Capability status 'soon' ligada como benefício vendável.
  const soonKeys = new Set(CAPABILITY_REGISTRY.filter((c) => c.status === 'soon').map((c) => c.key))
  for (const f of features) {
    if (f.enabled && soonKeys.has(f.sectionKey)) {
      const cap = CAPABILITY_REGISTRY.find((c) => c.key === f.sectionKey)
      warnings.push({
        severity: 'warning',
        plan: f.plan,
        message: `"${cap?.label ?? f.sectionKey}" está marcada como "em breve" mas ativada no ${f.plan} — não deveria contar como benefício vendável.`,
      })
    }
  }

  return warnings
}
