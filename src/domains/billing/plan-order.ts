import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

const FALLBACK_ORDER: PlanName[] = [
  PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE,
]

export async function getPlanOrder(): Promise<PlanName[]> {
  const plans = await prisma.plan.findMany({
    orderBy: { displayOrder: 'asc' },
    select: { name: true },
  })
  if (plans.length === 0) return FALLBACK_ORDER
  return plans.map((p) => p.name)
}

export function comparePlans(a: PlanName, b: PlanName, order: PlanName[]): number {
  return order.indexOf(a) - order.indexOf(b)
}
