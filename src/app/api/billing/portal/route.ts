import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { stripeBillingService } from '@/domains/billing/stripe-billing.service'

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)
    const result = await stripeBillingService.createPortalSession({ tenantId: session.tenantId })
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
