import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { PlanLimitsService } from './plan-limits.service'
import { LIMIT_REGISTRY } from '@/shared/permissions/limit-registry'

const TENANT_ID = 'tenant-abc'

const activeTenant = (plan: PlanName) => ({
  subscription: { plan, status: SubscriptionStatus.ACTIVE, trialEndsAt: null },
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
        subscription: { plan: PlanName.PRO, status: SubscriptionStatus.EXPIRED, trialEndsAt: null },
      } as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      await service.get(TENANT_ID, 'max_roles')
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.FREE, limitKey: 'max_roles' },
      })
    })

    it('usa plano FREE quando trial está expirado', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue({
        subscription: {
          plan: PlanName.STARTER,
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
        subscription: { plan: PlanName.STARTER, status: SubscriptionStatus.TRIALING, trialEndsAt: futureDate },
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

  describe('checkUsage', () => {
    it('warning a partir de 80%, exceeded em 100%', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.PRO) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 100 } as any)

      expect((await service.checkUsage(TENANT_ID, 'max_users', 80)).status).toBe('warning')
      expect((await service.checkUsage(TENANT_ID, 'max_users', 100)).status).toBe('exceeded')
      expect((await service.checkUsage(TENANT_ID, 'max_users', 50)).status).toBe('ok')
    })

    it('retorna exceeded e percent 100 quando o limite é zero (ex.: whatsapp no FREE)', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.FREE) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 0 } as any)

      const result = await service.checkUsage(TENANT_ID, 'max_whatsapp_month', 0)
      expect(result.status).toBe('exceeded')
      expect(result.percent).toBe(100)
      expect(Number.isFinite(result.percent)).toBe(true)
    })

    it('retorna ok e percent 0 quando o limite é ilimitado', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.ENTERPRISE) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 999999 } as any)

      const result = await service.checkUsage(TENANT_ID, 'max_roles', 500)
      expect(result.status).toBe('ok')
      expect(result.percent).toBe(0)
    })
  })

  describe('assertWithinLimit soft', () => {
    it('soft: permite até +10% de folga, bloqueia acima', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.STARTER) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 300 } as any)

      await expect(
        service.assertWithinLimit(TENANT_ID, 'max_appointments_month', 320)
      ).resolves.not.toThrow()
      await expect(
        service.assertWithinLimit(TENANT_ID, 'max_appointments_month', 331)
      ).rejects.toThrow()
    })
  })
})
