import { beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'

import { stripeBillingService } from './stripe-billing.service'
import { billingRepository } from './billing.repository'
import { stripe } from './stripe.client'
import { prisma } from '@/shared/database/prisma'

vi.mock('./stripe.client', () => ({
  stripe: {
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}))

vi.mock('./billing.repository', () => ({
  billingRepository: {
    getSubscription: vi.fn(),
    setStripeIds: vi.fn(),
  },
}))

function stripeResourceMissingError(message: string) {
  return new Stripe.errors.StripeInvalidRequestError({
    type: 'invalid_request_error',
    code: 'resource_missing',
    param: 'customer',
    message,
  })
}

const checkoutParams = {
  tenantId: 'tenant-1',
  ownerEmail: 'dono@negocio.com.br',
  ownerName: 'Dono',
  planName: 'PRO',
} as const

describe('StripeBillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    Object.assign(prisma, {
      plan: {
        findUnique: vi.fn().mockResolvedValue({ stripePriceId: 'price_pro', trialDays: 14 }),
      },
    })

    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    } as Stripe.Response<Stripe.Checkout.Session>)

    vi.mocked(stripe.customers.create).mockResolvedValue({
      id: 'cus_novo',
    } as Stripe.Response<Stripe.Customer>)

    vi.mocked(billingRepository.setStripeIds).mockResolvedValue({} as never)
  })

  describe('getOrCreateStripeCustomer', () => {
    it('reusa o customer salvo quando ele existe no Stripe', async () => {
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({
        stripeCustomerId: 'cus_existente',
      } as never)
      vi.mocked(stripe.customers.retrieve).mockResolvedValue({
        id: 'cus_existente',
        deleted: undefined,
      } as never)

      const customerId = await stripeBillingService.getOrCreateStripeCustomer({
        tenantId: 'tenant-1',
        ownerEmail: 'dono@negocio.com.br',
        ownerName: 'Dono',
      })

      expect(customerId).toBe('cus_existente')
      expect(stripe.customers.create).not.toHaveBeenCalled()
    })

    it('recria o customer quando o salvo não existe mais no Stripe (resource_missing)', async () => {
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({
        stripeCustomerId: 'cus_UgTFppBcTwrIMM',
      } as never)
      vi.mocked(stripe.customers.retrieve).mockRejectedValue(
        stripeResourceMissingError("No such customer: 'cus_UgTFppBcTwrIMM'"),
      )

      const customerId = await stripeBillingService.getOrCreateStripeCustomer({
        tenantId: 'tenant-1',
        ownerEmail: 'dono@negocio.com.br',
        ownerName: 'Dono',
      })

      expect(customerId).toBe('cus_novo')
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: 'dono@negocio.com.br',
        name: 'Dono',
        metadata: { tenantId: 'tenant-1' },
      })
      expect(billingRepository.setStripeIds).toHaveBeenCalledWith('tenant-1', {
        stripeCustomerId: 'cus_novo',
      })
    })

    it('recria o customer quando o salvo foi deletado no Stripe', async () => {
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({
        stripeCustomerId: 'cus_deletado',
      } as never)
      vi.mocked(stripe.customers.retrieve).mockResolvedValue({
        id: 'cus_deletado',
        deleted: true,
      } as never)

      const customerId = await stripeBillingService.getOrCreateStripeCustomer({
        tenantId: 'tenant-1',
        ownerEmail: 'dono@negocio.com.br',
        ownerName: 'Dono',
      })

      expect(customerId).toBe('cus_novo')
      expect(billingRepository.setStripeIds).toHaveBeenCalledWith('tenant-1', {
        stripeCustomerId: 'cus_novo',
      })
    })

    it('propaga erros do Stripe que não sejam resource_missing', async () => {
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({
        stripeCustomerId: 'cus_existente',
      } as never)
      vi.mocked(stripe.customers.retrieve).mockRejectedValue(
        new Stripe.errors.StripeAuthenticationError({
          type: 'invalid_request_error',
          message: 'Invalid API Key',
        }),
      )

      await expect(
        stripeBillingService.getOrCreateStripeCustomer({
          tenantId: 'tenant-1',
          ownerEmail: 'dono@negocio.com.br',
          ownerName: 'Dono',
        }),
      ).rejects.toThrow('Invalid API Key')

      expect(stripe.customers.create).not.toHaveBeenCalled()
    })

    it('cria customer novo quando não há stripeCustomerId salvo', async () => {
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({
        stripeCustomerId: null,
      } as never)

      const customerId = await stripeBillingService.getOrCreateStripeCustomer({
        tenantId: 'tenant-1',
        ownerEmail: 'dono@negocio.com.br',
        ownerName: 'Dono',
      })

      expect(customerId).toBe('cus_novo')
      expect(stripe.customers.retrieve).not.toHaveBeenCalled()
    })
  })

  describe('createCheckoutSession', () => {
    it('gera checkout com customer recriado quando o salvo não existe (bug produção 2026-07-03)', async () => {
      vi.mocked(billingRepository.getSubscription).mockResolvedValue({
        stripeCustomerId: 'cus_UgTFppBcTwrIMM',
        stripeSubId: null,
        status: 'TRIALING',
      } as never)
      vi.mocked(stripe.customers.retrieve).mockRejectedValue(
        stripeResourceMissingError("No such customer: 'cus_UgTFppBcTwrIMM'"),
      )

      const result = await stripeBillingService.createCheckoutSession(checkoutParams)

      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_123')
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_novo' }),
      )
    })
  })
})
