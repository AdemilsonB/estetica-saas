import { z } from 'zod'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { billingService } from '@/domains/billing/billing.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const changePlanSchema = z.object({
  plan: z.nativeEnum(PlanName),
  status: z.nativeEnum(SubscriptionStatus),
  reason: z.string().max(200).default('admin_manual_change'),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { tenantId } = await params
    const input = await validateInput(request, changePlanSchema)
    const updated = await billingService.changePlan(
      tenantId,
      input.plan,
      input.status,
      session.userId,
      input.reason,
    )
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
