import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName, SubscriptionStatus } from '@prisma/client'

vi.mock('@/shared/auth/session', () => ({
  getSessionContext: vi.fn(),
}))

vi.mock('@/domains/iam/iam.repository', () => ({
  iamRepository: { findUserById: vi.fn() },
}))

vi.mock('@/domains/billing/billing.repository', () => ({
  billingRepository: {
    getSubscription: vi.fn(),
    createSubscription: vi.fn(),
  },
}))

vi.mock('@/domains/billing/stripe-billing.service', () => ({
  stripeBillingService: { createCheckoutSession: vi.fn() },
}))

import { getSessionContext } from '@/shared/auth/session'
import { iamRepository } from '@/domains/iam/iam.repository'
import { billingRepository } from '@/domains/billing/billing.repository'
import { stripeBillingService } from '@/domains/billing/stripe-billing.service'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSessionContext).mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      isOwner: true,
      permissions: {},
    } as never)
    vi.mocked(iamRepository.findUserById).mockResolvedValue({
      id: 'user-1',
      email: 'dono@salao.com',
      name: 'Dono',
    } as never)
    vi.mocked(stripeBillingService.createCheckoutSession).mockResolvedValue({
      checkoutUrl: 'https://checkout.stripe.com/session-1',
    })
  })

  it('cria Subscription placeholder quando tenant nunca passou pelo trial (checkout direto)', async () => {
    vi.mocked(billingRepository.getSubscription).mockResolvedValue(null)

    const res = await POST(makeRequest({ planName: 'PRO', skipTrial: true }))

    expect(res.status).toBe(200)
    expect(billingRepository.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        plan: PlanName.PRO,
        status: SubscriptionStatus.EXPIRED,
      }),
    )
  })

  it('não recria Subscription quando já existe (fluxo pós-trial)', async () => {
    vi.mocked(billingRepository.getSubscription).mockResolvedValue({
      tenantId: 'tenant-1',
      status: SubscriptionStatus.EXPIRED,
      stripeSubId: null,
      trialEndsAt: null,
    } as never)

    const res = await POST(makeRequest({ planName: 'PRO', skipTrial: true }))

    expect(res.status).toBe(200)
    expect(billingRepository.createSubscription).not.toHaveBeenCalled()
  })
})
