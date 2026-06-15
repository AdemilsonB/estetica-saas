import { prisma } from '@/shared/database/prisma'
import type { ListCatalogProductsQuery } from './types'

export class CatalogMasterProductRepository {
  async list(query: ListCatalogProductsQuery) {
    const { segments, categoryId, name, page = 1, pageSize = 20 } = query

    const items = await prisma.catalogProduct.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments } }),
        ...(categoryId && { categoryId }),
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
      },
      include: { category: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const total = await prisma.catalogProduct.count({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments } }),
        ...(categoryId && { categoryId }),
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
      },
    })

    return { data: items, total, page, pageSize }
  }

  async findById(id: string) {
    return prisma.catalogProduct.findUnique({
      where: { id },
      include: { category: true },
    })
  }

  async listCategories(segments?: string[]) {
    return prisma.catalogProductCategory.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments as any } }),
      },
      orderBy: { order: 'asc' },
    })
  }
}

export const catalogMasterProductRepository = new CatalogMasterProductRepository()
