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

  it('avisa quando capacidade soon (whatsapp_premium/campaigns) está habilitada como benefício', async () => {
    // Onda 0 — alinhamento da oferta: 'soon' habilitada num plano é vender roadmap
    // como ativo. O guard deve sinalizar (não bloqueia, só avisa — #254).
    vi.mocked(order.getPlanOrder).mockResolvedValue(['STARTER', 'PRO'] as never)
    vi.mocked(prisma.planLimitConfig.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([
      { plan: 'PRO', sectionKey: 'whatsapp_premium', enabled: true },
      { plan: 'STARTER', sectionKey: 'campaigns', enabled: false },
    ] as never)

    const warnings = await getPlanConfigWarnings()
    expect(warnings.some((w) => w.plan === 'PRO' && /em breve/i.test(w.message))).toBe(true)
    // 'campaigns' desligada não deve gerar aviso.
    expect(warnings.some((w) => w.plan === 'STARTER')).toBe(false)
  })
})
