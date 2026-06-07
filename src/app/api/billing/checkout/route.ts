import { z } from 'zod'
import { PlanName } from '@prisma/client'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { stripeBillingService } from '@/domains/billing/stripe-billing.service'
import { iamRepository } from '@/domains/iam/iam.repository'

const CheckoutSchema = z.object({
  planName:  z.enum(['STARTER', 'PRO', 'ENTERPRISE']),
  skipTrial: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)
    const body = await req.json()
    const { planName, skipTrial } = CheckoutSchema.parse(body)

    const user = await iamRepository.findUserById(session.tenantId, session.userId)
    if (!user) throw new Error('Usuário não encontrado')

    const result = await stripeBillingService.createCheckoutSession({
      tenantId: session.tenantId,
      ownerEmail: user.email,
      ownerName: user.name,
      planName: planName as PlanName,
      skipTrial,
    })

    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
