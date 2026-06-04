import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { makeWhatsAppUsage } from '@/shared/test/factories/whatsapp-usage.factory'

vi.mock('@/domains/billing/plan-limits.service', () => ({
  planLimitsService: { get: vi.fn() },
}))

import { planLimitsService } from '@/domains/billing/plan-limits.service'
import { WhatsAppQuotaService } from './whatsapp-quota.service'

const service = new WhatsAppQuotaService()

describe('WhatsAppQuotaService', () => {
  beforeEach(() => {
    vi.mocked(planLimitsService.get).mockResolvedValue(500)
  })

  describe('checkAndIncrement', () => {
    it('retorna true e incrementa quando abaixo do limite', async () => {
      prismaMock.whatsAppMonthlyUsage.upsert.mockResolvedValue(makeWhatsAppUsage({ count: 100 }))

      const result = await service.checkAndIncrement('tenant-1')

      expect(result).toBe(true)
      expect(prismaMock.whatsAppMonthlyUsage.upsert).toHaveBeenCalledOnce()
      expect(prismaMock.whatsAppMonthlyUsage.update).not.toHaveBeenCalled()
    })

    it('retorna false e reverte o increment quando ultrapassa o limite (500)', async () => {
      prismaMock.whatsAppMonthlyUsage.upsert.mockResolvedValue(makeWhatsAppUsage({ count: 501 }))
      prismaMock.whatsAppMonthlyUsage.update.mockResolvedValue(makeWhatsAppUsage({ count: 500 }))

      const result = await service.checkAndIncrement('tenant-1')

      expect(result).toBe(false)
      expect(prismaMock.whatsAppMonthlyUsage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { count: { decrement: 1 } },
        })
      )
    })

    it('retorna true para limite ilimitado (999999)', async () => {
      vi.mocked(planLimitsService.get).mockResolvedValue(999999)
      prismaMock.whatsAppMonthlyUsage.upsert.mockResolvedValue(makeWhatsAppUsage({ count: 10000 }))

      const result = await service.checkAndIncrement('tenant-1')

      expect(result).toBe(true)
    })

    it('retorna false para FREE (limite 0)', async () => {
      vi.mocked(planLimitsService.get).mockResolvedValue(0)
      prismaMock.whatsAppMonthlyUsage.upsert.mockResolvedValue(makeWhatsAppUsage({ count: 1 }))
      prismaMock.whatsAppMonthlyUsage.update.mockResolvedValue(makeWhatsAppUsage({ count: 0 }))

      const result = await service.checkAndIncrement('tenant-1')

      expect(result).toBe(false)
    })
  })

  describe("decrement", () => {
    it("decrementa o count do mês corrente (apenas se count > 0)", async () => {
      prismaMock.whatsAppMonthlyUsage.updateMany.mockResolvedValue({ count: 1 });

      await service.decrement("tenant-1");

      expect(prismaMock.whatsAppMonthlyUsage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "tenant-1",
            count: { gt: 0 },
          }),
          data: { count: { decrement: 1 } },
        }),
      );
    });
  });

  describe("getUsage", () => {
    it("retorna used, limit e resetDate corretos", async () => {
      prismaMock.whatsAppMonthlyUsage.findUnique.mockResolvedValue(
        makeWhatsAppUsage({ count: 347 }),
      );

      const result = await service.getUsage("tenant-1");

      expect(result.used).toBe(347);
      expect(result.limit).toBe(500);
      expect(result.resetDate).toMatch(/^\d{4}-\d{2}-01$/);
    });

    it("retorna used=0 quando não há registro para o mês", async () => {
      prismaMock.whatsAppMonthlyUsage.findUnique.mockResolvedValue(null);

      const result = await service.getUsage("tenant-1");

      expect(result.used).toBe(0);
    });
  });
});
