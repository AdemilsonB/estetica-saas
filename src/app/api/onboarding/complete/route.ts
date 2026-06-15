import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { catalogDomainService } from '@/domains/catalog/catalog.service'

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    await catalogDomainService.completeOnboarding(session.tenantId)
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
