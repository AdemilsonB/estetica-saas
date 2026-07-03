import { schedulingService } from '@/domains/scheduling/scheduling.service'
import { appointmentCountsQuerySchema } from '@/domains/scheduling/types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(request: Request) {
  initializeDomainRuntime()

  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.appointments.view)

    const { searchParams } = new URL(request.url)
    const query = appointmentCountsQuerySchema.parse({
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    })

    const result = await schedulingService.getAppointmentCounts(
      session.tenantId,
      new Date(query.from),
      new Date(query.to),
    )
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
