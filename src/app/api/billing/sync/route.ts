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
 * Resolve casos onde o status ficou desatualizado (ex: EXPIRED incorreto).
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)

    const sub = await billingRepository.getSubscription(session.tenantId)
    if (!sub?.stripeSubId) {
      throw new DomainError(
        'Nenhuma assinatura Stripe encontrada para sincronizar.',
        'NO_STRIPE_SUBSCRIPTION',
        400,
      )
    }

    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubId, {
      expand: ['items.data.price'],
    })

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

    await billingRepository.setStripeIds(session.tenantId, {
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
      synced: true,
      plan:   planName,
      status: newStatus,
      currentPeriodEnd: periodDates.currentPeriodEnd,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
