import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { PackageRepository } from '../package.repository'
import { Prisma } from '@prisma/client'

const repo = new PackageRepository()

const mockItem = {
  id: 'item-1',
  packageId: 'pkg-1',
  serviceId: 'svc-1',
  service: { id: 'svc-1', name: 'Corte', duration: 60, price: new Prisma.Decimal('50.00') },
}

const mockPackage = {
  id: 'pkg-1',
  tenantId: 'tenant-1',
  name: 'Combo Corte + Barba',
  description: null,
  price: new Prisma.Decimal('80.00'),
  imageUrl: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [mockItem],
}

describe('PackageRepository', () => {
  beforeEach(() => {
    prismaMock.servicePackage.findMany.mockResolvedValue([mockPackage] as never)
    prismaMock.servicePackage.findFirst.mockResolvedValue(mockPackage as never)
    prismaMock.servicePackage.create.mockResolvedValue(mockPackage as never)
    prismaMock.servicePackage.update.mockResolvedValue(mockPackage as never)
  })

  it('list() filtra por tenantId e retorna apenas ativos', async () => {
    await repo.list('tenant-1')
    expect(prismaMock.servicePackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', active: true }),
      }),
    )
  })

  it('findById() filtra por tenantId e id', async () => {
    await repo.findById('tenant-1', 'pkg-1')
    expect(prismaMock.servicePackage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pkg-1', tenantId: 'tenant-1' },
      }),
    )
  })

  it('create() injeta tenantId e cria serviceIds como items', async () => {
    await repo.create('tenant-1', { name: 'Combo', price: 80, serviceIds: ['svc-1', 'svc-2'] })
    expect(prismaMock.servicePackage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Combo',
          items: { create: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }] },
        }),
      }),
    )
  })

  it('deactivate() seta active: false sem deletar registro', async () => {
    await repo.deactivate('tenant-1', 'pkg-1')
    expect(prismaMock.servicePackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pkg-1', tenantId: 'tenant-1' },
        data: { active: false },
      }),
    )
  })
})
