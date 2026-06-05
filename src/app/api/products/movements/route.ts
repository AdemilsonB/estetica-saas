import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { listMovementsSchema } from '@/domains/inventory/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const url = new URL(request.url)
    const filters = listMovementsSchema.parse(Object.fromEntries(url.searchParams))
    const result = await inventoryService.listMovements(session.tenantId, filters)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
