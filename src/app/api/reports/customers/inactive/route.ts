import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { analyticsService } from '@/domains/reports/analytics.service'
import { inactiveCustomersSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.customers.view)

    const sp = new URL(request.url).searchParams
    const input = inactiveCustomersSchema.parse({
      days: sp.get('days') ?? undefined,
      page: sp.get('page') ?? undefined,
    })

    const result = await analyticsService.getInactiveCustomersReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
