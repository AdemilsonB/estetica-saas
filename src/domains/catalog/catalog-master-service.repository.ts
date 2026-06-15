import { prisma } from '@/shared/database/prisma'
import type { ListCatalogServicesQuery } from './types'

export class CatalogMasterServiceRepository {
  async list(query: ListCatalogServicesQuery) {
    const { segments, categoryId, name, page = 1, pageSize = 20 } = query

    const items = await prisma.catalogService.findMany({
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

    const total = await prisma.catalogService.count({
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
    return prisma.catalogService.findUnique({
      where: { id },
      include: { category: true },
    })
  }

  async listCategories(segments?: string[]) {
    return prisma.catalogServiceCategory.findMany({
      where: {
        active: true,
        ...(segments?.length && { segments: { hasSome: segments as any } }),
      },
      orderBy: { order: 'asc' },
    })
  }
}

export const catalogMasterServiceRepository = new CatalogMasterServiceRepository()
