import { BusinessSegment } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import type { ListCatalogServicesQuery } from './types'

export class CatalogMasterServiceRepository {
  async list(query: ListCatalogServicesQuery) {
    const { segments, categoryId, name, page = 1, pageSize = 20 } = query

    const where = {
      active: true,
      ...(segments?.length && { segments: { hasSome: segments } }),
      ...(categoryId && { categoryId }),
      ...(name && { name: { contains: name, mode: 'insensitive' as const } }),
    }

    const [items, total] = await Promise.all([
      prisma.catalogService.findMany({
        where,
        include: { category: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.catalogService.count({ where }),
    ])

    return { data: items, total, page, pageSize }
  }

  async findById(id: string) {
    return prisma.catalogService.findUnique({
      where: { id },
      include: { category: true },
    })
  }

  async listCategories(segments?: Array<BusinessSegment>) {
    return prisma.catalogServiceCategory.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments } }),
      },
      orderBy: { order: 'asc' },
    })
  }
}

export const catalogMasterServiceRepository = new CatalogMasterServiceRepository()
