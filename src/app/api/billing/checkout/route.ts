import { z } from 'zod'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { stripeBillingService } from '@/domains/billing/stripe-billing.service'
import { iamRepository } from '@/domains/iam/iam.repository'
import { billingRepository } from '@/domains/billing/billing.repository'
import { DomainError } from '@/shared/errors/domain-error'

const CheckoutSchema = z.object({
  planName:   z.enum(['STARTER', 'PRO', 'ENTERPRISE']),
  skipTrial:  z.boolean().optional().default(false),
  successUrl: z.string().url().optional(),
  cancelUrl:  z.string().url().optional(),
})

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
]

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)
    const body = await req.json()
    const { planName, skipTrial, successUrl, cancelUrl } = CheckoutSchema.parse(body)

    const sub = await billingRepository.getSubscription(session.tenantId)

    // Bloqueia se já existe assinatura gerenciada pelo Stripe
    if (sub?.stripeSubId) {
      throw new DomainError(
        'Você já possui uma assinatura ativa. Para mudar de plano, use o portal de assinatura.',
        'SUBSCRIPTION_EXISTS',
        409,
      )
    }

    // Trial expirado sem stripeSubId — não é uma assinatura ativa, permite novo checkout
    const isExpiredTrial =
      sub?.status === SubscriptionStatus.TRIALING &&
      sub.trialEndsAt != null &&
      sub.trialEndsAt < new Date()

    // Bloqueia se status é ativo, exceto trial expirado (protege contra race condition no webhook)
    if (sub && ACTIVE_STATUSES.includes(sub.status) && !isExpiredTrial) {
      throw new DomainError(
        'Você já possui uma assinatura ativa. Para mudar de plano, use o portal de assinatura.',
        'SUBSCRIPTION_EXISTS',
        409,
      )
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
