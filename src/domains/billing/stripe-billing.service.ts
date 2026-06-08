import { PlanName } from '@prisma/client'
import { stripe } from './stripe.client'
import { billingRepository } from './billing.repository'
import { DomainError } from '@/shared/errors/domain-error'
import { prisma } from '@/shared/database/prisma'

export class StripeBillingService {
  async getOrCreateStripeCustomer(params: {
    tenantId: string
    ownerEmail: string
    ownerName: string
  }): Promise<string> {
    const sub = await billingRepository.getSubscription(params.tenantId)

    if (sub?.stripeCustomerId) return sub.stripeCustomerId

    const customer = await stripe.customers.create({
      email: params.ownerEmail,
      name: params.ownerName,
      metadata: { tenantId: params.tenantId },
    })

    await billingRepository.setStripeIds(params.tenantId, { stripeCustomerId: customer.id })
    return customer.id
  }

  async createCheckoutSession(params: {
    tenantId: string
    ownerEmail: string
    ownerName: string
    planName: PlanName
    skipTrial?: boolean
    successUrl?: string
    cancelUrl?: string
  }): Promise<{ checkoutUrl: string }> {
    const plan = await prisma.plan.findUnique({
      where: { name: params.planName },
      select: { stripePriceId: true, trialDays: true },
    })

    if (!plan?.stripePriceId) {
      throw new DomainError(
        `Plano ${params.planName} não tem Stripe Price ID configurado. Configure em Admin → Planos.`,
        'INVALID_PLAN',
        400,
      )
    }

    const priceId = plan.stripePriceId
    const trialDays = params.skipTrial ? 0 : (plan.trialDays ?? 0)

    const customerId = await this.getOrCreateStripeCustomer({
      tenantId: params.tenantId,
      ownerEmail: params.ownerEmail,
      ownerName: params.ownerName,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl ?? `${appUrl}/configuracoes/planos?stripe=success`,
      cancel_url: params.cancelUrl ?? `${appUrl}/configuracoes/planos?stripe=cancelled`,
      metadata: { tenantId: params.tenantId, planName: params.planName },
      ...(trialDays > 0 && {
        subscription_data: { trial_period_days: trialDays },
        payment_method_collection: 'always',
      }),
    })

    if (!session.url) throw new DomainError('Falha ao criar sessão de checkout.', 'STRIPE_ERROR', 500)
    return { checkoutUrl: session.url }
  }

  async createPortalSession(params: { tenantId: string }): Promise<{ portalUrl: string }> {
    const sub = await billingRepository.getSubscription(params.tenantId)
    if (!sub?.stripeCustomerId) {
      throw new DomainError('Tenant não tem cadastro no Stripe.', 'NO_STRIPE_CUSTOMER', 400)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/configuracoes/planos`,
    })

    return { portalUrl: session.url }
  }
}

export const stripeBillingService = new StripeBillingService()
