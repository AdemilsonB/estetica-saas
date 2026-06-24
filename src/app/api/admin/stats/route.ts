import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import type { PlanName } from '@prisma/client'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)

    const [totalTenants, planCounts, recentCount] = await Promise.all([
      prisma.tenant.count(),
      prisma.subscription.groupBy({ by: ['plan'], _count: { _all: true } }),
      prisma.tenant.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ])

    const countByPlan = Object.fromEntries(
      planCounts.map((r) => [r.plan, r._count._all]),
    ) as Partial<Record<PlanName, number>>

    return Response.json({ totalTenants, recentCount, countByPlan })
  } catch (error) {
    return handleApiError(error)
  }
}
