import { prisma } from '@/shared/database/prisma'

export class SchedulingPolicyRepository {
  async findByTenant(tenantId: string) {
    return prisma.schedulingPolicy.findUnique({ where: { tenantId } })
  }

  async findOrCreateByTenant(tenantId: string) {
    const existing = await this.findByTenant(tenantId)
    if (existing) return existing
    return prisma.schedulingPolicy.create({ data: { tenantId } })
  }

  async upsert(
    tenantId: string,
    data: {
      paddingMinutes?: number
      minAdvanceMinutes?: number
      maxAdvanceDays?: number
      allowPublicBooking?: boolean
    },
  ) {
    return prisma.schedulingPolicy.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    })
  }
}

export const schedulingPolicyRepository = new SchedulingPolicyRepository()
