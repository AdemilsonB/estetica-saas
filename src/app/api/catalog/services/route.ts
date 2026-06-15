import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'
import { listCatalogServicesSchema } from '@/domains/catalog/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const url = new URL(request.url)

    // segments pode vir como múltiplos query params: ?segments=HAIR_SALON&segments=BARBERSHOP
    const rawSegments = url.searchParams.getAll('segments')
    const params = Object.fromEntries(url.searchParams)
    const query = listCatalogServicesSchema.parse({
      ...params,
      segments: rawSegments.length ? rawSegments : undefined,
    })

    const result = await catalogDomainService.listServices(query)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
