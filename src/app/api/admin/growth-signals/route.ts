import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getGrowthSignals } from '@/domains/billing/growth-signals.service'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const signals = await getGrowthSignals()
    return Response.json(signals)
  } catch (error) {
    return handleApiError(error)
  }
}
