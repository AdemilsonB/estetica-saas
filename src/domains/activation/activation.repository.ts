import { prisma } from '@/shared/database/prisma'
import type { ActivationCounts } from './types'

export class ActivationRepository {
  async getActivationCounts(tenantId: string): Promise<ActivationCounts> {
    const [
      activeCategoryCount,
      activeServiceCount,
      activeCustomerCount,
      customRoleCount,
      tenant,
      branding,
    ] = await Promise.all([
      prisma.serviceCategory.count({ where: { tenantId, active: true } }),
      prisma.service.count({ where: { tenantId, active: true } }),
      prisma.customer.count({ where: { tenantId, deletedAt: null } }),
      prisma.role.count({ where: { tenantId, isDefault: false } }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { phone: true, address: true, businessHours: true, evolutionConnected: true },
      }),
      prisma.brandingConfig.findUnique({
        where: { tenantId },
        select: { logoUrl: true },
      }),
    ])

    return {
      activeCategoryCount,
      activeServiceCount,
      activeCustomerCount,
      customRoleCount,
      tenant: {
        phone: tenant?.phone ?? null,
        address: tenant?.address ?? null,
        businessHours: tenant?.businessHours ?? null,
        evolutionConnected: tenant?.evolutionConnected ?? false,
      },
      logoUrl: branding?.logoUrl ?? null,
    }
  }
}

export const activationRepository = new ActivationRepository()
