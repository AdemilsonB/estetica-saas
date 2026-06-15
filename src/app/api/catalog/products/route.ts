import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'
import { listCatalogProductsSchema } from '@/domains/catalog/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const url = new URL(request.url)

    const rawSegments = url.searchParams.getAll('segments')
    const params = Object.fromEntries(url.searchParams)
    const query = listCatalogProductsSchema.parse({
      ...params,
      segments: rawSegments.length ? rawSegments : undefined,
    })

    const result = await catalogDomainService.listProducts(query)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
