import { z } from 'zod'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { stripeBillingService } from '@/domains/billing/stripe-billing.service'
import { iamRepository } from '@/domains/iam/iam.repository'
import { billingRepository } from '@/domains/billing/billing.repository'
import { DomainError } from '@/shared/errors/domain-error'
import { ForbiddenError } from '@/shared/errors'

const CheckoutSchema = z.object({
  planName:   z.enum(['STARTER', 'PRO', 'ENTERPRISE']),
  skipTrial:  z.boolean().optional().default(false),
  successUrl: z.string().url().optional(),
  cancelUrl:  z.string().url().optional(),
})

// Statuses que indicam assinatura Stripe ativa/em andamento — bloqueia novo checkout
const STRIPE_IN_PROGRESS: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
]

// Fallback para assinatura ativa sem stripeSubId (ex: race condition antes do webhook)
const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
]

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode contratar um plano.')
    const body = await req.json()
    const { planName, skipTrial, successUrl, cancelUrl } = CheckoutSchema.parse(body)

    const sub = await billingRepository.getSubscription(session.tenantId)

    // Trial expirado por tempo (trialEndsAt < now), independente do status no DB:
    // o webhook pode estar atrasado, mas o usuário já perdeu o acesso via featureGuard.
    // Neste caso deixamos prosseguir para o checkout.
    const trialExpiredByTime =
      sub?.trialEndsAt != null && sub.trialEndsAt < new Date()

    // Bloqueia se existe assinatura Stripe ativa/em andamento E trial não expirou por tempo.
    // CANCELLED, EXPIRED ou trial vencido com stripeSubId podem fazer novo checkout.
    if (sub?.stripeSubId && STRIPE_IN_PROGRESS.includes(sub.status) && !trialExpiredByTime) {
      throw new DomainError(
        'Você já possui uma assinatura ativa. Para mudar de plano, use o portal de assinatura.',
        'SUBSCRIPTION_EXISTS',
        409,
      )
    }

    // Fallback: bloqueia se status indica ativa mesmo sem stripeSubId (race condition no webhook)
    if (sub && !sub.stripeSubId && ACTIVE_STATUSES.includes(sub.status) && !trialExpiredByTime) {
      throw new DomainError(
        'Você já possui uma assinatura ativa. Para mudar de plano, use o portal de assinatura.',
        'SUBSCRIPTION_EXISTS',
        409,
      )
    }

    // Tenant que nunca passou pelo trial (checkout direto no onboarding) ainda não
    // tem Subscription no banco — cria um placeholder sem entitlement antes do Stripe,
    // já que setStripeIds/changePlan (aqui e no webhook) fazem update assumindo a linha existir.
    if (!sub) {
      await billingRepository.createSubscription({
        tenantId: session.tenantId,
        plan: planName as PlanName,
        status: SubscriptionStatus.EXPIRED,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      })
    }

    const user = await iamRepository.findUserById(session.tenantId, session.userId)
    if (!user) throw new DomainError('Usuário não encontrado', 'NOT_FOUND', 404)

    const result = await stripeBillingService.createCheckoutSession({
      tenantId: session.tenantId,
      ownerEmail: user.email,
      ownerName: user.name,
      planName: planName as PlanName,
      skipTrial,
      successUrl,
      cancelUrl,
    })

    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
