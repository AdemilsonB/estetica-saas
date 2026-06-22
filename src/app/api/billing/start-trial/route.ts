import { z } from 'zod'
import { PlanName } from '@prisma/client'
import { getSessionContext } from '@/shared/auth/session'
import { validateInput } from '@/shared/http/validate-input'
import { handleApiError } from '@/shared/http/handle-api-error'
import { ForbiddenError } from '@/shared/errors'
import { billingService } from '@/domains/billing/billing.service'

const Schema = z.object({
  planName: z.nativeEnum(PlanName),
})

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode iniciar o trial.')
    const { planName } = await validateInput(req, Schema)
    const sub = await billingService.startTrialForPlan(session.tenantId, planName)
    return Response.json(sub, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
