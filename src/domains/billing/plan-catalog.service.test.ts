import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { getPublicPlans } from './plan-catalog.service'

describe('getPublicPlans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gera benefícios da config e destaques de description (máx. 3)', async () => {
    prismaMock.plan.findMany.mockResolvedValue([
      {
        name: PlanName.STARTER,
        displayName: 'Starter',
        price: 49 as unknown as never,
        trialDays: 14,
        description: 'Ideal para começar\nSuporte por WhatsApp\nSem fidelidade\nLinha extra ignorada',
      },
    ] as never)
    prismaMock.planFeatureConfig.findMany.mockResolvedValue([
      { plan: PlanName.STARTER, sectionKey: 'agenda' },
      { plan: PlanName.STARTER, sectionKey: 'whatsapp_basic' },
    ] as never)
    prismaMock.planLimitConfig.findMany.mockResolvedValue([
      { plan: PlanName.STARTER, limitKey: 'max_users', value: 5 },
      { plan: PlanName.STARTER, limitKey: 'max_whatsapp_month', value: 0 },
    ] as never)

    const [plan] = await getPublicPlans()
    expect(plan.name).toBe(PlanName.STARTER)
    expect(plan.price).toBe(49)
    expect(plan.isPopular).toBe(false)
    expect(plan.highlights).toEqual(['Ideal para começar', 'Suporte por WhatsApp', 'Sem fidelidade'])
    expect(plan.benefits).toContain('Agenda completa')
    expect(plan.benefits).toContain('WhatsApp automático')
    expect(plan.benefits).toContain('Até 5 profissionais')
    expect(plan.benefits.some((b) => b.includes('WhatsApp/mês'))).toBe(false) // limite 0 ignorado
  })

  it('marca PRO como isPopular e trata description nula', async () => {
    prismaMock.plan.findMany.mockResolvedValue([
      { name: PlanName.PRO, displayName: 'Pro', price: 89 as unknown as never, trialDays: 14, description: null },
    ] as never)
    prismaMock.planFeatureConfig.findMany.mockResolvedValue([] as never)
    prismaMock.planLimitConfig.findMany.mockResolvedValue([] as never)

    const [plan] = await getPublicPlans()
    expect(plan.isPopular).toBe(true)
    expect(plan.highlights).toEqual([])
    expect(plan.benefits).toEqual([])
  })
})
