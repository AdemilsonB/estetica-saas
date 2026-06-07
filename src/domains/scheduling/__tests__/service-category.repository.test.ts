import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { ServiceCategoryRepository } from '../service-category.repository'
import { ConflictError } from '@/shared/errors'

const TENANT = 'tenant-1'

describe('ServiceCategoryRepository', () => {
  let repo: ServiceCategoryRepository

  beforeEach(() => {
    repo = new ServiceCategoryRepository()
  })

  describe('list', () => {
    it('retorna categorias ativas ordenadas por order', async () => {
      const cats = [
        { id: 'cat-1', tenantId: TENANT, name: 'Alisamentos', order: 0, active: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cat-2', tenantId: TENANT, name: 'Coloração', order: 1, active: true, createdAt: new Date(), updatedAt: new Date() },
      ]
      prismaMock.serviceCategory.findMany.mockResolvedValue(cats as any)

      const result = await repo.list(TENANT)

      expect(prismaMock.serviceCategory.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, active: true },
        orderBy: { order: 'asc' },
      })
      expect(result).toEqual(cats)
    })
  })

  describe('create', () => {
    it('cria categoria com tenantId', async () => {
      const created = { id: 'cat-1', tenantId: TENANT, name: 'Alisamentos', order: 0, active: true, createdAt: new Date(), updatedAt: new Date() }
      prismaMock.serviceCategory.create.mockResolvedValue(created as any)

      const result = await repo.create(TENANT, { name: 'Alisamentos' })

      expect(prismaMock.serviceCategory.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT, name: 'Alisamentos' },
      })
      expect(result).toEqual(created)
    })
  })

  describe('update', () => {
    it('atualiza nome e order', async () => {
      const updated = { id: 'cat-1', tenantId: TENANT, name: 'Novo Nome', order: 2, active: true, createdAt: new Date(), updatedAt: new Date() }
      prismaMock.serviceCategory.update.mockResolvedValue(updated as any)

      const result = await repo.update(TENANT, 'cat-1', { name: 'Novo Nome', order: 2 })

      expect(prismaMock.serviceCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-1', tenantId: TENANT },
        data: { name: 'Novo Nome', order: 2 },
      })
      expect(result).toEqual(updated)
    })
  })

  describe('delete', () => {
    it('lança ConflictError se categoria tiver serviços vinculados', async () => {
      prismaMock.service.count.mockResolvedValue(2)

      await expect(repo.delete(TENANT, 'cat-1')).rejects.toThrow(ConflictError)
    })

    it('desativa categoria se não tiver serviços', async () => {
      prismaMock.service.count.mockResolvedValue(0)
      prismaMock.serviceCategory.update.mockResolvedValue({} as any)

      await repo.delete(TENANT, 'cat-1')

      expect(prismaMock.serviceCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-1', tenantId: TENANT },
        data: { active: false },
      })
    })
  })
})
