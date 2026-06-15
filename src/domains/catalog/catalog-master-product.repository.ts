import { BusinessSegment } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import type { ListCatalogProductsQuery } from './types'

export class CatalogMasterProductRepository {
  async list(query: ListCatalogProductsQuery) {
    const { segments, categoryId, name, page = 1, pageSize = 20 } = query

    const where = {
      active: true,
      ...(segments?.length && { segments: { hasSome: segments } }),
      ...(categoryId && { categoryId }),
      ...(name && { name: { contains: name, mode: 'insensitive' as const } }),
    }

    const [items, total] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        include: { category: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.catalogProduct.count({ where }),
    ])

    return { data: items, total, page, pageSize }
  }

  async findById(id: string) {
    return prisma.catalogProduct.findUnique({
      where: { id },
      include: { category: true },
    })
  }

  async listCategories(segments?: Array<BusinessSegment>) {
    return prisma.catalogProductCategory.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments } }),
      },
      orderBy: { order: 'asc' },
    })
  }
}

export const catalogMasterProductRepository = new CatalogMasterProductRepository()
