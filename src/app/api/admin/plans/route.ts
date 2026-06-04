import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const plans = await prisma.plan.findMany({ orderBy: { displayOrder: 'asc' } })
    return Response.json(plans)
  } catch (error) {
    return handleApiError(error)
  }
}
