import { schedulingService } from '@/domains/scheduling/scheduling.service'
import { updatePromotionSchema } from '@/domains/scheduling/types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const { id } = await params
    const input = await validateInput(request, updatePromotionSchema)
    const promotion = await schedulingService.updatePromotion(session.tenantId, id, input)
    return Response.json(promotion)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.services.manage)
    const { id } = await params
    await schedulingService.deactivatePromotion(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
