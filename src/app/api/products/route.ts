import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { inventoryService } from '@/domains/inventory/inventory.service'
import { createProductSchema, listProductsSchema } from '@/domains/inventory/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, 'produtos', 'view')
    const url = new URL(request.url)
    const filters = listProductsSchema.parse(Object.fromEntries(url.searchParams))
    const result = await inventoryService.listProducts(session.tenantId, filters)
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
    const input = await validateInput(request, createProductSchema)
    const result = await inventoryService.createProduct(session.tenantId, input)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
