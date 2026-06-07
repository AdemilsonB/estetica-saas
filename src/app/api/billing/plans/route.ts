import { prisma } from '@/shared/database/prisma'
import { LIMIT_REGISTRY, type LimitKey } from '@/shared/permissions/limit-registry'
import { PlanName } from '@prisma/client'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    })

    const limitKeys = Object.keys(LIMIT_REGISTRY) as LimitKey[]

    const limitConfigs = await prisma.planLimitConfig.findMany({
      where: { plan: { in: plans.map(p => p.name) } },
    })

    const plansWithLimits = plans.map(plan => {
      const limits: Record<string, number> = {}
      for (const key of limitKeys) {
        const config = limitConfigs.find(c => c.plan === plan.name && c.limitKey === key)
        limits[key] = config?.value ?? LIMIT_REGISTRY[key].defaults[plan.name as PlanName] ?? 0
      }
      return {
        name: plan.name,
        displayName: plan.displayName,
        price: Number(plan.price),
        trialDays: plan.trialDays,
        limits,
      }
    })

    return Response.json({ plans: plansWithLimits })
  } catch (error) {
    return handleApiError(error)
  }
}
