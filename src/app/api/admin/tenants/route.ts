import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [tenants, planLimits] = await Promise.all([
      prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          plan: true,
          isBlocked: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              appointments: { where: { createdAt: { gte: startOfMonth } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.planLimitConfig.findMany({
        where: { limitKey: 'appointments_month' },
        select: { plan: true, value: true },
      }),
    ])

    const limitByPlan = Object.fromEntries(planLimits.map((l) => [l.plan, l.value]))

    return Response.json(
      tenants.map((t) => ({
        ...t,
        appointmentsThisMonth: t._count.appointments,
        appointmentsLimit: limitByPlan[t.plan] ?? null,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
