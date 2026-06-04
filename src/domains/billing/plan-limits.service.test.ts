import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { PlanLimitsService } from './plan-limits.service'
import { LIMIT_REGISTRY } from '@/shared/permissions/limit-registry'

const TENANT_ID = 'tenant-abc'

const activeTenant = (plan: PlanName) => ({
  plan,
  subscription: { status: SubscriptionStatus.ACTIVE, trialEndsAt: null },
})

describe('PlanLimitsService', () => {
  let service: PlanLimitsService

  beforeEach(() => {
    service = new PlanLimitsService()
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('retorna valor do PlanLimitConfig quando existe no banco', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.PRO) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 10 } as any)

      const result = await service.get(TENANT_ID, 'max_roles')
      expect(result).toBe(10)
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.PRO, limitKey: 'max_roles' },
      })
    })

    it('retorna fallback do LIMIT_REGISTRY quando registro não existe no banco', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.FREE) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      const result = await service.get(TENANT_ID, 'max_roles')
      expect(result).toBe(LIMIT_REGISTRY.max_roles.defaults.FREE)
    })

    it('usa plano FREE quando subscription está expirada', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue({
        plan: PlanName.PRO,
        subscription: { status: SubscriptionStatus.EXPIRED, trialEndsAt: null },
      } as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      await service.get(TENANT_ID, 'max_roles')
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.FREE, limitKey: 'max_roles' },
      })
    })

    it('usa plano FREE quando trial está expirado', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue({
        plan: PlanName.STARTER,
        subscription: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: new Date('2020-01-01'),
        },
      } as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      await service.get(TENANT_ID, 'max_users')
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.FREE, limitKey: 'max_users' },
      })
    })

    it('usa o plano real quando trial ainda é válido', async () => {
      const futureDate = new Date(Date.now() + 86400000)
      prismaMock.tenant.findFirst.mockResolvedValue({
        plan: PlanName.STARTER,
        subscription: { status: SubscriptionStatus.TRIALING, trialEndsAt: futureDate },
      } as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      await service.get(TENANT_ID, 'max_users')
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.STARTER, limitKey: 'max_users' },
      })
    })
  })

  describe('assertWithinLimit', () => {
    it('não lança erro quando contagem está abaixo do limite', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.PRO) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 5 } as any)

      await expect(service.assertWithinLimit(TENANT_ID, 'max_roles', 4)).resolves.not.toThrow()
    })

    it('lança PlanLimitError quando contagem atinge o limite', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.FREE) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 3 } as any)

      await expect(service.assertWithinLimit(TENANT_ID, 'max_roles', 3)).rejects.toThrow()
    })

    it('não lança erro quando valor é 999999 (ilimitado)', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.ENTERPRISE) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 999999 } as any)

      await expect(service.assertWithinLimit(TENANT_ID, 'max_roles', 9999)).resolves.not.toThrow()
    })
  })
})
