import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { billingService } from '@/domains/billing/billing.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { tenantId } = await params
    const updated = await billingService.resetTrial(tenantId, session.userId)
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
