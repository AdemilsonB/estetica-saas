import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const [services, products] = await Promise.all([
      prisma.catalogServiceCategory.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: { order: 'asc' },
      }),
      prisma.catalogProductCategory.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: { order: 'asc' },
      }),
    ])
    return Response.json({ services, products })
  } catch (error) {
    return handleApiError(error)
  }
}
