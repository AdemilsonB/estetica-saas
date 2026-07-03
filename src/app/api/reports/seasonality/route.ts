import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { analyticsService } from '@/domains/reports/analytics.service'
import { seasonalityReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.appointments.view)

    const sp = new URL(request.url).searchParams
    const input = seasonalityReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      professionalId: sp.get('professionalId') ?? undefined,
      categoryId: sp.get('categoryId') ?? undefined,
    })

    const result = await analyticsService.getSeasonalityReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
