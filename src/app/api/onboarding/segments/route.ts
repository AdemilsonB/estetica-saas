import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { catalogDomainService } from '@/domains/catalog/catalog.service'
import { saveSegmentsSchema } from '@/domains/catalog/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const segments = await catalogDomainService.getTenantSegments(session.tenantId)
    return Response.json({ segments })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const input = await validateInput(request, saveSegmentsSchema)
    await catalogDomainService.saveSegments(session.tenantId, input)
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
