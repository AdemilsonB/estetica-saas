import Stripe from 'stripe'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { billingRepository } from '@/domains/billing/billing.repository'
import { billingService } from '@/domains/billing/billing.service'
import { stripe } from '@/domains/billing/stripe.client'
import { DomainError } from '@/shared/errors/domain-error'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

function stripeStatusToLocal(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':   return SubscriptionStatus.ACTIVE
    case 'trialing': return SubscriptionStatus.TRIALING
    case 'past_due': return SubscriptionStatus.PAST_DUE
    case 'canceled': return SubscriptionStatus.CANCELLED
    default:         return SubscriptionStatus.EXPIRED
  }
}

/**
 * POST /api/billing/sync
 * Sincroniza o status da assinatura local com o estado real no Stripe.
 * Tenta pelo stripeSubId atual; se cancelado ou ausente, busca a subscription
 * ativa pelo stripeCustomerId (cobre o caso em que o portal criou uma nova sub).
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)

    const sub = await billingRepository.getSubscription(session.tenantId)
    if (!sub?.stripeCustomerId) {
      throw new DomainError(
        'Nenhuma assinatura Stripe encontrada para sincronizar.',
        'NO_STRIPE_SUBSCRIPTION',
        400,
      )
    }

    let stripeSub: Stripe.Subscription | null = null

    // Tenta a subscription atual primeiro
    if (sub.stripeSubId) {
      const retrieved = await stripe.subscriptions.retrieve(sub.stripeSubId, {
        expand: ['items.data.price'],
      })
      if (retrieved.status !== 'canceled') {
        stripeSub = retrieved
      }
    }

    // Se cancelada ou ausente, busca a subscription ativa pelo customer
    if (!stripeSub) {
      const list = await stripe.subscriptions.list({
        customer: sub.stripeCustomerId,
        status: 'active',
        limit: 1,
        expand: ['data.items.data.price'],
      })
      stripeSub = list.data[0] ?? null
    }

    // Tenta também status trialing caso não haja ativa
    if (!stripeSub) {
      const list = await stripe.subscriptions.list({
        customer: sub.stripeCustomerId,
        status: 'trialing',
        limit: 1,
        expand: ['data.items.data.price'],
      })
      stripeSub = list.data[0] ?? null
    }

    if (!stripeSub) {
      await billingService.changePlan(
        session.tenantId,
        sub.plan,
        SubscriptionStatus.CANCELLED,
        'sync',
        'no_active_subscription',
      )
      return Response.json({ synced: true, plan: sub.plan, status: SubscriptionStatus.CANCELLED })
    }

    const newStatus = stripeStatusToLocal(stripeSub.status)
    const priceId   = stripeSub.items.data[0]?.price.id ?? ''

    const plan = priceId
      ? await prisma.plan.findFirst({ where: { stripePriceId: priceId }, select: { name: true } })
      : null
    const planName = plan?.name ?? sub.plan ?? PlanName.STARTER

    const periodDates = {
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd:   new Date(stripeSub.current_period_end   * 1000),
    }

    // Atualiza stripeSubId se o portal criou uma nova subscription
    await billingRepository.setStripeIds(session.tenantId, {
      stripeSubId:       stripeSub.id,
      stripePriceId:     priceId,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    })

    await billingService.changePlan(
      session.tenantId,
      planName,
      newStatus,
      'sync',
      'manual_sync',
      periodDates,
    )

    return Response.json({
      synced:          true,
      plan:            planName,
      status:          newStatus,
      currentPeriodEnd: periodDates.currentPeriodEnd,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
