import { prisma } from '@/shared/database/prisma'
import type { UpdateBrandingInput } from './branding.schemas'

export class BrandingRepository {
  async findByTenant(tenantId: string) {
    return prisma.brandingConfig.findUnique({ where: { tenantId } })
  }

  async create(tenantId: string, data?: Partial<UpdateBrandingInput>) {
    return prisma.brandingConfig.create({
      data: { tenantId, ...data },
    })
  }

  async update(tenantId: string, data: Partial<UpdateBrandingInput>) {
    return prisma.brandingConfig.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    })
  }
}

export const brandingRepository = new BrandingRepository()
