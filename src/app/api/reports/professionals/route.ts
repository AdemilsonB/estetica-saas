import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { reportsService } from '@/domains/reports/reports.service'
import { professionalsReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.appointments.view)

    const url = new URL(request.url)
    const sp = url.searchParams
    const input = professionalsReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      professionalIds: sp.getAll('professionalIds').length > 0 ? sp.getAll('professionalIds') : undefined,
      serviceId: sp.get('serviceId') ?? undefined,
      status: sp.getAll('status').length > 0 ? sp.getAll('status') : undefined,
    })

    const result = await reportsService.getProfessionalsReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
