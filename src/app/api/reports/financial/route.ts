import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { reportsService } from '@/domains/reports/reports.service'
import { financialReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.financial.view)

    const url = new URL(request.url)
    const sp = url.searchParams
    const input = financialReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      type: sp.get('type') ?? undefined,
      professionalId: sp.get('professionalId') ?? undefined,
      serviceId: sp.get('serviceId') ?? undefined,
      categoryId: sp.get('categoryId') ?? undefined,
      groupBy: sp.get('groupBy') ?? undefined,
    })

    const result = await reportsService.getFinancialReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
