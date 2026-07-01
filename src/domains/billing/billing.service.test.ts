import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { TrialAlreadyUsedError } from '@/shared/errors'

vi.mock('./billing.repository', () => ({
  billingRepository: {
    getSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    createSubscription: vi.fn(),
    addHistory: vi.fn(),
    findExpiredTrials: vi.fn(),
    findExpiredActive: vi.fn(),
  },
}))

import { billingRepository } from './billing.repository'
import { billingService } from './billing.service'

const TENANT_ID = 'tenant-abc'

describe('BillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // changePlan/resetTrial envolvem as escritas em $transaction; executa o callback.
    prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock))
  })

  describe('runExpireSweep', () => {
    it('expira trial mantendo o plano original — nunca rebaixa para FREE', async () => {
      vi.mocked(billingRepository.findExpiredTrials).mockResolvedValue([
        { tenantId: TENANT_ID, plan: PlanName.PRO } as any,
      ])
      vi.mocked(billingRepository.findExpiredActive).mockResolvedValue([])
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({
        plan: PlanName.PRO,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      } as any)
      vi.mocked(billingRepository.updateSubscription).mockResolvedValue({ id: 'sub-1' } as any)

      await billingService.runExpireSweep()

      expect(billingRepository.updateSubscription).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ plan: PlanName.PRO, status: SubscriptionStatus.EXPIRED }),
        expect.anything(),
      )
    })

    it('expira assinatura por fim de período mantendo o plano original', async () => {
      vi.mocked(billingRepository.findExpiredTrials).mockResolvedValue([])
      vi.mocked(billingRepository.findExpiredActive).mockResolvedValue([
        { tenantId: TENANT_ID, plan: PlanName.STARTER } as any,
      ])
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({
        plan: PlanName.STARTER,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      } as any)
      vi.mocked(billingRepository.updateSubscription).mockResolvedValue({ id: 'sub-1' } as any)

      await billingService.runExpireSweep()

      expect(billingRepository.updateSubscription).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ plan: PlanName.STARTER, status: SubscriptionStatus.EXPIRED }),
        expect.anything(),
      )
    })
  })

  describe('startTrialForPlan', () => {
    it('cria nova assinatura em trial quando tenant não possui subscription', async () => {
      vi.mocked(billingRepository.getSubscription).mockResolvedValue(null)
      prismaMock.plan.findUnique.mockResolvedValue({ trialDays: 14 } as any)
      vi.mocked(billingRepository.createSubscription).mockResolvedValue({ id: 'sub-1' } as any)

      await billingService.startTrialForPlan(TENANT_ID, PlanName.STARTER)

      expect(billingRepository.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID, plan: PlanName.STARTER, status: SubscriptionStatus.TRIALING }),
      )
    })

    it('rejeita novo trial quando o tenant já possui subscription (mesmo expirada/cancelada)', async () => {
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({ id: 'sub-1' } as any)

      await expect(billingService.startTrialForPlan(TENANT_ID, PlanName.PRO)).rejects.toThrow(
        TrialAlreadyUsedError,
      )

      expect(billingRepository.updateSubscription).not.toHaveBeenCalled()
      expect(billingRepository.createSubscription).not.toHaveBeenCalled()
    })
  })
})
