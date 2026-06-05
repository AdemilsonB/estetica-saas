import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { createCategorySchema } from '@/domains/inventory/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const result = await inventoryService.listCategories(session.tenantId)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'create')
    const input = await validateInput(request, createCategorySchema)
    const result = await inventoryService.createCategory(session.tenantId, input.name)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
