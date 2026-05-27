import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { reportsService } from '@/domains/reports/reports.service'
import { customersReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.customers.view)

    const url = new URL(request.url)
    const sp = url.searchParams
    const input = customersReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      professionalId: sp.get('professionalId') ?? undefined,
      serviceId: sp.get('serviceId') ?? undefined,
    })

    const result = await reportsService.getCustomersReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
