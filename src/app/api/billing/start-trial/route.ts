import { z } from 'zod'
import { PlanName } from '@prisma/client'
import { withTenant } from '@/shared/auth/session'
import { validateInput } from '@/shared/http/validate-input'
import { handleApiError } from '@/shared/http/handle-api-error'
import { billingService } from '@/domains/billing/billing.service'

const Schema = z.object({
  planName: z.nativeEnum(PlanName),
})

export async function POST(req: Request) {
  try {
    const tenantId = await withTenant(req)
    const { planName } = await validateInput(req, Schema)
    const sub = await billingService.startTrialForPlan(tenantId, planName)
    return Response.json(sub, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
