import { prisma } from '@/shared/database/prisma'

function formatPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export const adminRepository = {
  async findTenantDetail(tenantId: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
        isBlocked: true,
        blockedReason: true,
        evolutionConnected: true,
        evolutionPhone: true,
        evolutionStatus: true,
        createdAt: true,
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            stripeCustomerId: true,
            history: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                fromPlan: true,
                toPlan: true,
                fromStatus: true,
                toStatus: true,
                reason: true,
                changedBy: true,
                createdAt: true,
              },
            },
          },
        },
        usageSnapshots: {
          where: { period: formatPeriod(now) },
          select: { limitKey: true, count: true, period: true },
        },
        _count: {
          select: {
            appointments: { where: { createdAt: { gte: startOfMonth } } },
            notifications: { where: { createdAt: { gte: startOfMonth } } },
            customers: true,
            users: true,
          },
        },
      },
    })
  },

  async blockTenant(tenantId: string, reason?: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { isBlocked: true, blockedReason: reason ?? null },
    })
  },

  async unblockTenant(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { isBlocked: false, blockedReason: null },
    })
  },
}
