import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { reportsService } from '@/domains/reports/reports.service'
import { appointmentsReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.appointments.view)

    const url = new URL(request.url)
    const sp = url.searchParams
    const input = appointmentsReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      status: sp.getAll('status').length > 0 ? sp.getAll('status') : undefined,
      professionalId: sp.get('professionalId') ?? undefined,
      serviceId: sp.get('serviceId') ?? undefined,
      categoryId: sp.get('categoryId') ?? undefined,
      groupBy: sp.get('groupBy') ?? undefined,
    })

    const result = await reportsService.getAppointmentsReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
