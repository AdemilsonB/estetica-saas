import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { serviceTemplateSchema } from '@/domains/inventory/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const { id } = await params
    const result = await inventoryService.getServiceTemplate(session.tenantId, id)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'edit')
    const { id } = await params
    const input = await validateInput(request, serviceTemplateSchema)
    const result = await inventoryService.saveServiceTemplate(session.tenantId, id, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
