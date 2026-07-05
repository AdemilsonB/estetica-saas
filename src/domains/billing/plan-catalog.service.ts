import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { buildPlanBenefits } from '@/shared/permissions/plan-benefits'

export type PublicPlan = {
  name: PlanName
  displayName: string
  price: number
  trialDays: number
  isPopular: boolean
  highlights: string[]
  benefits: string[]
}

function parseHighlights(description: string | null): string[] {
  if (!description) return []
  return description
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
}

/**
 * Monta o catálogo público de planos a partir da config real do banco
 * (Plan + PlanFeatureConfig + PlanLimitConfig), sem N+1: uma query em lote
 * por tabela, filtrando por `plan in names`, e junta tudo em memória.
 */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: { name: true, displayName: true, price: true, trialDays: true, description: true },
  })

  const names = plans.map((p) => p.name)
  const [features, limits] = await Promise.all([
    prisma.planFeatureConfig.findMany({
      where: { plan: { in: names }, enabled: true },
      select: { plan: true, sectionKey: true },
    }),
    prisma.planLimitConfig.findMany({
      where: { plan: { in: names } },
      select: { plan: true, limitKey: true, value: true },
    }),
  ])

  return plans.map((p) => {
    const enabledCapabilityKeys = features
      .filter((f) => f.plan === p.name)
      .map((f) => f.sectionKey)
    const planLimits: Record<string, number> = {}
    for (const l of limits) {
      if (l.plan === p.name) planLimits[l.limitKey] = l.value
    }
    return {
      name: p.name,
      displayName: p.displayName,
      price: Number(p.price),
      trialDays: p.trialDays,
      isPopular: p.name === PlanName.PRO,
      highlights: parseHighlights(p.description),
      benefits: buildPlanBenefits({ enabledCapabilityKeys, limits: planLimits }),
    }
  })
}
