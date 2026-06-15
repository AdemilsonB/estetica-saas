import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const { id } = await params
    const result = await catalogDomainService.activateProduct(session.tenantId, id)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
