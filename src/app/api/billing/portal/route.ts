import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { stripeBillingService } from '@/domains/billing/stripe-billing.service'
import { ForbiddenError } from '@/shared/errors'

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)
    if (!session.isOwner) throw new ForbiddenError('Apenas o dono pode gerenciar a assinatura.')
    const result = await stripeBillingService.createPortalSession({ tenantId: session.tenantId })
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
