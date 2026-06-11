import { PlanName, SubscriptionStatus } from '@prisma/client'
import Stripe from 'stripe'
import { stripe } from '@/domains/billing/stripe.client'
import { billingRepository } from '@/domains/billing/billing.repository'
import { billingService } from '@/domains/billing/billing.service'
import { prisma } from '@/shared/database/prisma'

async function planFromPriceId(priceId: string): Promise<PlanName | null> {
  if (!priceId) return null
  const plan = await prisma.plan.findFirst({
    where: { stripePriceId: priceId },
    select: { name: true },
  })
  return plan?.name ?? null
}

function stripeStatusToSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':   return SubscriptionStatus.ACTIVE
    case 'trialing': return SubscriptionStatus.TRIALING
    case 'past_due': return SubscriptionStatus.PAST_DUE
    case 'canceled': return SubscriptionStatus.CANCELLED
    default:         return SubscriptionStatus.EXPIRED
  }
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Assinatura inválida.' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return Response.json({ error: 'Webhook inválido.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      // Evento primário para checkout: usa planName do metadata diretamente,
      // sem depender de lookup por priceId. Dispara por último no fluxo,
      // quando pagamento e assinatura já estão confirmados.
      case 'checkout.session.completed': {
        const sess = event.data.object as Stripe.Checkout.Session
        if (sess.mode !== 'subscription') break

        const tenantId    = sess.metadata?.tenantId
        const planNameStr = sess.metadata?.planName
        if (!tenantId || !planNameStr) break

        const stripeSubId = typeof sess.subscription === 'string' ? sess.subscription : null
        if (!stripeSubId) break

        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId)
        const planName  = planNameStr as PlanName
        const newStatus = stripeStatusToSubscriptionStatus(stripeSub.status)
        const priceId   = stripeSub.items.data[0]?.price.id ?? ''

        const periodDates = {
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd:   new Date(stripeSub.current_period_end   * 1000),
        }

        await billingRepository.setStripeIds(tenantId, {
          stripeSubId,
          stripePriceId:     priceId,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        })

        await billingService.changePlan(tenantId, planName, newStatus, 'stripe-webhook', event.type, periodDates)

        // Sincroniza data de fim de trial se assinatura estiver em período de teste
        if (stripeSub.trial_end) {
          await billingRepository.updateSubscription(tenantId, {
            trialEndsAt: new Date(stripeSub.trial_end * 1000),
          })
        }
        break
      }

      // Eventos de ciclo de vida da assinatura (renovação, upgrade via portal, cancelamento pendente).
      // Para novos checkouts, checkout.session.completed já tratou — este handler serve de fallback
      // e para mudanças que não passam pelo checkout (Customer Portal).
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription

        // Tenta obter tenantId da metadata da subscription; se ausente (ex: subscription
        // criada diretamente pelo Customer Portal), faz fallback pelo stripeCustomerId.
        let tenantId: string | undefined = sub.metadata?.tenantId
        if (!tenantId) {
          const customerId = typeof sub.customer === 'string' ? sub.customer : null
          if (customerId) {
            const existing = await billingRepository.findByStripeCustomerId(customerId)
            tenantId = existing?.tenantId
          }
        }
        if (!tenantId) break

        const priceId = sub.items.data[0]?.price.id ?? ''

        // Usa planName do metadata como fonte primária; fallback para lookup por priceId
        const metadataPlan = sub.metadata?.planName as PlanName | undefined
        const planName     = metadataPlan ?? (await planFromPriceId(priceId)) ?? PlanName.STARTER
        const newStatus    = stripeStatusToSubscriptionStatus(sub.status)

        await billingRepository.setStripeIds(tenantId, {
          stripeSubId:       sub.id,
          stripePriceId:     priceId,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })

        const periodDates = {
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd:   new Date(sub.current_period_end   * 1000),
        }

        await billingService.changePlan(tenantId, planName, newStatus, 'stripe-webhook', event.type, periodDates)

        // Sincroniza data de fim de trial se assinatura estiver em período de teste
        if (sub.trial_end) {
          await billingRepository.updateSubscription(tenantId, {
            trialEndsAt: new Date(sub.trial_end * 1000),
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        let tenantId: string | undefined = sub.metadata?.tenantId
        if (!tenantId) {
          const customerId = typeof sub.customer === 'string' ? sub.customer : null
          if (customerId) {
            const existing = await billingRepository.findByStripeCustomerId(customerId)
            tenantId = existing?.tenantId
          }
        }
        if (!tenantId) break
        await billingService.changePlan(tenantId, PlanName.FREE, SubscriptionStatus.CANCELLED, 'stripe-webhook', 'subscription_deleted')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : null
        if (!stripeSubId) break
        const sub = await billingRepository.findByStripeSubId(stripeSubId)
        if (!sub) break
        await billingService.changePlan(sub.tenantId, sub.plan, SubscriptionStatus.PAST_DUE, 'stripe-webhook', 'payment_failed')
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : null
        if (!stripeSubId) break
        const existingSub = await billingRepository.findByStripeSubId(stripeSubId)
        if (!existingSub || existingSub.status !== SubscriptionStatus.PAST_DUE) break
        await billingService.changePlan(existingSub.tenantId, existingSub.plan, SubscriptionStatus.ACTIVE, 'stripe-webhook', 'payment_succeeded')
        break
      }
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('[webhook] Erro ao processar evento', event.type, error)
    return Response.json({ error: 'Erro interno no webhook.' }, { status: 500 })
  }
}
