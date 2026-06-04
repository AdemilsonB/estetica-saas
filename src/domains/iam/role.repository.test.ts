import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { RoleRepository } from './role.repository'

const TENANT_ID = 'tenant-abc'
const ROLE_ID   = 'role-xyz'

const fakeRole = {
  id: ROLE_ID,
  tenantId: TENANT_ID,
  name: 'Gerente',
  isDefault: true,
  permissions: { agenda: ['view', 'create'] },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  _count: { users: 3 },
}

describe('RoleRepository', () => {
  let repo: RoleRepository

  beforeEach(() => {
    repo = new RoleRepository()
  })

  describe('findAll', () => {
    it('retorna cargos do tenant com contagem de usuários', async () => {
      prismaMock.role.findMany.mockResolvedValue([fakeRole] as any)
      const result = await repo.findAll(TENANT_ID)
      expect(prismaMock.role.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        include: { _count: { select: { users: true } } },
        orderBy: { createdAt: 'asc' },
      })
      expect(result).toHaveLength(1)
    })
  })

  describe('findById', () => {
    it('retorna cargo pelo id filtrando tenantId', async () => {
      prismaMock.role.findFirst.mockResolvedValue(fakeRole as any)
      await repo.findById(TENANT_ID, ROLE_ID)
      expect(prismaMock.role.findFirst).toHaveBeenCalledWith({
        where: { id: ROLE_ID, tenantId: TENANT_ID },
      })
    })

    it('retorna null quando não encontrado', async () => {
      prismaMock.role.findFirst.mockResolvedValue(null)
      const result = await repo.findById(TENANT_ID, 'inexistente')
      expect(result).toBeNull()
    })
  })

  describe('countByTenant', () => {
    it('conta cargos do tenant', async () => {
      prismaMock.role.count.mockResolvedValue(3)
      const count = await repo.countByTenant(TENANT_ID)
      expect(count).toBe(3)
      expect(prismaMock.role.count).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } })
    })
  })

  describe('create', () => {
    it('cria cargo com tenantId correto', async () => {
      prismaMock.role.create.mockResolvedValue(fakeRole as any)
      await repo.create(TENANT_ID, { name: 'Gerente', permissions: { agenda: ['view'] } })
      expect(prismaMock.role.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID, name: 'Gerente', permissions: { agenda: ['view'] } },
      })
    })
  })

  describe('update', () => {
    it('atualiza cargo filtrando tenantId', async () => {
      prismaMock.role.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.role.findFirstOrThrow.mockResolvedValue(fakeRole as any)
      await repo.update(TENANT_ID, ROLE_ID, { name: 'Gerente Sênior' })
      expect(prismaMock.role.updateMany).toHaveBeenCalledWith({
        where: { id: ROLE_ID, tenantId: TENANT_ID },
        data: { name: 'Gerente Sênior' },
      })
    })
  })

  describe('countUsers', () => {
    it('conta usuários vinculados ao cargo', async () => {
      prismaMock.user.count.mockResolvedValue(5)
      const count = await repo.countUsers(TENANT_ID, ROLE_ID)
      expect(prismaMock.user.count).toHaveBeenCalledWith({
        where: { roleId: ROLE_ID, tenantId: TENANT_ID },
      })
      expect(count).toBe(5)
    })
  })

  describe('delete', () => {
    it('exclui cargo filtrando tenantId', async () => {
      prismaMock.role.deleteMany.mockResolvedValue({ count: 1 })
      await repo.delete(TENANT_ID, ROLE_ID)
      expect(prismaMock.role.deleteMany).toHaveBeenCalledWith({
        where: { id: ROLE_ID, tenantId: TENANT_ID },
      })
    })
  })
})
