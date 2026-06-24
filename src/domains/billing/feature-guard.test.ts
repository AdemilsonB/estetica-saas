import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { FeatureGuard } from './feature-guard'

vi.mock('@/domains/billing/plan-limits.service', () => ({
  planLimitsService: { assertWithinLimit: vi.fn() },
}))

import { planLimitsService } from '@/domains/billing/plan-limits.service'

const TENANT_ID = 'tenant-abc'

describe('FeatureGuard', () => {
  let guard: FeatureGuard

  beforeEach(() => {
    guard = new FeatureGuard()
    vi.clearAllMocks()
    prismaMock.tenant.findUnique.mockResolvedValue({
      subscription: { plan: PlanName.STARTER, status: SubscriptionStatus.ACTIVE, trialEndsAt: null },
    } as any)
  })

  describe('canAccess', () => {
    it('retorna true quando feature está habilitada no plano', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: true } as any)
      expect(await guard.canAccess(TENANT_ID, 'whatsapp_basic')).toBe(true)
    })

    it('retorna false quando feature está desabilitada no plano', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: false } as any)
      expect(await guard.canAccess(TENANT_ID, 'reports_advanced')).toBe(false)
    })

    it('retorna false quando registro não existe no banco', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue(null)
      expect(await guard.canAccess(TENANT_ID, 'multi_unit')).toBe(false)
    })

    it('retorna false quando subscription está inativa', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        subscription: { plan: PlanName.PRO, status: SubscriptionStatus.CANCELLED, trialEndsAt: null },
      } as any)
      expect(await guard.canAccess(TENANT_ID, 'whatsapp_basic')).toBe(false)
    })
  })

  describe('assertAccess', () => {
    it('não lança erro quando acesso é permitido', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: true } as any)
      await expect(guard.assertAccess(TENANT_ID, 'whatsapp_basic')).resolves.not.toThrow()
    })

    it('lança PlanFeatureError quando acesso é negado', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: false } as any)
      prismaMock.planFeatureConfig.findMany.mockResolvedValue([
        { plan: PlanName.PRO } as any,
      ])
      await expect(guard.assertAccess(TENANT_ID, 'reports_advanced')).rejects.toThrow()
    })
  })

  describe('assertWithinLimit', () => {
    it('delega para planLimitsService com mapeamento users → max_users', async () => {
      vi.mocked(planLimitsService.assertWithinLimit).mockResolvedValue(undefined)
      await guard.assertWithinLimit(TENANT_ID, 'users', 3)
      expect(planLimitsService.assertWithinLimit).toHaveBeenCalledWith(TENANT_ID, 'max_users', 3)
    })

    it('delega appointments_month para max_appointments_month', async () => {
      vi.mocked(planLimitsService.assertWithinLimit).mockResolvedValue(undefined)
      await guard.assertWithinLimit(TENANT_ID, 'appointments_month', 100)
      expect(planLimitsService.assertWithinLimit).toHaveBeenCalledWith(TENANT_ID, 'max_appointments_month', 100)
    })

    it('propaga erro do planLimitsService', async () => {
      vi.mocked(planLimitsService.assertWithinLimit).mockRejectedValue(new Error('Limite'))
      await expect(guard.assertWithinLimit(TENANT_ID, 'users', 5)).rejects.toThrow('Limite')
    })
  })
})
