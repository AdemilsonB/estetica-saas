import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { updateProductSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, updateProductSchema)
    const result = await inventoryService.updateProduct(session.tenantId, id, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'delete')
    const { id } = await params
    await inventoryService.deleteProduct(session.tenantId, id)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
