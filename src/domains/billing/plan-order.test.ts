import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { getPlanOrder, comparePlans } from './plan-order'

describe('plan-order', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deriva a ordem de Plan.displayOrder', async () => {
    prismaMock.plan.findMany.mockResolvedValue([
      { name: PlanName.FREE }, { name: PlanName.STARTER },
      { name: PlanName.PRO }, { name: PlanName.ENTERPRISE },
    ] as any)
    expect(await getPlanOrder()).toEqual([
      PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE,
    ])
  })

  it('usa fallback quando o banco não retorna planos', async () => {
    prismaMock.plan.findMany.mockResolvedValue([] as any)
    expect(await getPlanOrder()).toEqual([
      PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE,
    ])
  })

  it('comparePlans respeita a ordem fornecida', () => {
    const order = [PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE]
    expect(comparePlans(PlanName.STARTER, PlanName.PRO, order)).toBeLessThan(0)
    expect(comparePlans(PlanName.ENTERPRISE, PlanName.FREE, order)).toBeGreaterThan(0)
  })
})
