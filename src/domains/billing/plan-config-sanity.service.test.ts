import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import * as order from '@/domains/billing/plan-order'
import { getPlanConfigWarnings } from './plan-config-sanity.service'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    planLimitConfig: { findMany: vi.fn() },
    planFeatureConfig: { findMany: vi.fn() },
  },
}))
vi.mock('@/domains/billing/plan-order', () => ({ getPlanOrder: vi.fn() }))

describe('getPlanConfigWarnings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aponta monotonicidade quebrada (plano maior com limite menor)', async () => {
    vi.mocked(order.getPlanOrder).mockResolvedValue(['STARTER', 'PRO'] as never)
    vi.mocked(prisma.planLimitConfig.findMany).mockResolvedValue([
      { plan: 'STARTER', limitKey: 'max_users', value: 5 },
      { plan: 'PRO', limitKey: 'max_users', value: 3 },
    ] as never)
    vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([] as never)

    const warnings = await getPlanConfigWarnings()
    expect(warnings.some((w) => w.plan === 'PRO' && /max_users|usuários/i.test(w.message))).toBe(true)
  })

  it('não aponta nada quando os limites são monotônicos', async () => {
    vi.mocked(order.getPlanOrder).mockResolvedValue(['STARTER', 'PRO'] as never)
    vi.mocked(prisma.planLimitConfig.findMany).mockResolvedValue([
      { plan: 'STARTER', limitKey: 'max_users', value: 5 },
      { plan: 'PRO', limitKey: 'max_users', value: 20 },
    ] as never)
    vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([] as never)

    const warnings = await getPlanConfigWarnings()
    expect(warnings).toHaveLength(0)
  })
})
