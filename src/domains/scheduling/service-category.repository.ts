import { type Prisma } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { ConflictError } from '@/shared/errors'

export type CreateCategoryInput = Omit<Prisma.ServiceCategoryUncheckedCreateInput, 'tenantId' | 'id' | 'createdAt' | 'updatedAt' | 'active' | 'services'>
export type UpdateCategoryInput = Pick<Prisma.ServiceCategoryUpdateInput, 'name' | 'order'>

export class ServiceCategoryRepository {
  async list(tenantId: string) {
    return prisma.serviceCategory.findMany({
      where: { tenantId, active: true },
      orderBy: { order: 'asc' },
    })
  }

  async create(tenantId: string, input: CreateCategoryInput) {
    return prisma.serviceCategory.create({
      data: { tenantId, name: input.name, ...(input.order !== undefined && { order: input.order }) },
    })
  }

  async update(tenantId: string, id: string, input: UpdateCategoryInput) {
    return prisma.serviceCategory.update({
      where: { id, tenantId },
      data: input,
    })
  }

  async delete(tenantId: string, id: string) {
    const count = await prisma.service.count({ where: { categoryId: id, tenantId } })
    if (count > 0) {
      throw new ConflictError('Categoria possui serviços vinculados. Remova o vínculo antes de excluir.')
    }
    await prisma.serviceCategory.update({
      where: { id, tenantId },
      data: { active: false },
    })
  }
}

export const serviceCategoryRepository = new ServiceCategoryRepository()
