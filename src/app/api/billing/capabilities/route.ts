import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { getTenantCapabilities } from '@/domains/billing/capabilities.service'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const caps = await getTenantCapabilities(session.tenantId)
    return Response.json(caps)
  } catch (error) {
    return handleApiError(error)
  }
}
