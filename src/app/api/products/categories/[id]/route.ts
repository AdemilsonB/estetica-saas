import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { inventoryService } from '@/domains/inventory/inventory.service'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'delete')
    const { id } = await params
    await inventoryService.deleteCategory(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
