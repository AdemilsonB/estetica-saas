import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getPlanConfigWarnings } from '@/domains/billing/plan-config-sanity.service'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const warnings = await getPlanConfigWarnings()
    return Response.json(warnings)
  } catch (error) {
    return handleApiError(error)
  }
}
