import { activationService } from '@/domains/activation/activation.service'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const status = await activationService.getStatus(session.tenantId)
    return Response.json(status)
  } catch (error) {
    return handleApiError(error)
  }
}
