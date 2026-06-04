import { prisma } from '@/shared/database/prisma'

type CreateRoleInput = {
  name: string
  permissions: Record<string, string[]>
}

type UpdateRoleInput = {
  name?: string
  permissions?: Record<string, string[]>
}

export class RoleRepository {
  async findAll(tenantId: string) {
    return prisma.role.findMany({
      where: { tenantId },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findById(tenantId: string, id: string) {
    return prisma.role.findFirst({ where: { id, tenantId } })
  }

  async countByTenant(tenantId: string) {
    return prisma.role.count({ where: { tenantId } })
  }

  async countUsers(tenantId: string, roleId: string) {
    return prisma.user.count({ where: { roleId, tenantId } })
  }

  async create(tenantId: string, data: CreateRoleInput) {
    return prisma.role.create({ data: { tenantId, ...data } })
  }

  async update(tenantId: string, id: string, data: UpdateRoleInput) {
    await prisma.role.updateMany({ where: { id, tenantId }, data })
    return prisma.role.findFirstOrThrow({ where: { id, tenantId } })
  }

  async delete(tenantId: string, id: string) {
    return prisma.role.deleteMany({ where: { id, tenantId } })
  }
}

export const roleRepository = new RoleRepository()
