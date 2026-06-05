import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeProduct } from '@/shared/test/factories/product.factory'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    productCategory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    serviceProduct: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    appointmentProduct: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/shared/database/prisma'
import { ProductRepository } from '../product.repository'

const repo = new ProductRepository()

beforeEach(() => vi.clearAllMocks())

describe('findById', () => {
  it('sempre filtra por tenantId e active:true', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
    await repo.findById('tenant-A', 'prod-1')
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-A', id: 'prod-1', active: true }),
      }),
    )
  })

  it('retorna null quando produto não existe', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
    const result = await repo.findById('t1', 'nonexistent')
    expect(result).toBeNull()
  })
})

describe('list', () => {
  it('filtra por tenantId e active:true em todos os casos', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([])
    await repo.list('tenant-X', { page: 1, pageSize: 20 })
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-X', active: true }),
      }),
    )
  })

  it('aplica filtro lowStock em memória — retorna apenas produtos com estoque <= alerta', async () => {
    const products = [
      makeProduct({ id: 'p1', stockQuantity: 3, lowStockAlert: 5 }),
      makeProduct({ id: 'p2', stockQuantity: 10, lowStockAlert: 5 }),
      makeProduct({ id: 'p3', stockQuantity: 5, lowStockAlert: 5 }),
    ]
    vi.mocked(prisma.product.findMany).mockResolvedValue(products as any)

    const result = await repo.list('t1', { lowStock: true, page: 1, pageSize: 20 })

    expect(result.data).toHaveLength(2)
    expect(result.data.map((p: any) => p.id)).toEqual(['p1', 'p3'])
  })

  it('retorna todos quando lowStock não está definido', async () => {
    const products = [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' })]
    vi.mocked(prisma.product.findMany).mockResolvedValue(products as any)

    const result = await repo.list('t1', { page: 1, pageSize: 20 })
    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('aplica paginação corretamente', async () => {
    const products = Array.from({ length: 5 }, (_, i) => makeProduct({ id: `p${i}` }))
    vi.mocked(prisma.product.findMany).mockResolvedValue(products as any)

    const result = await repo.list('t1', { page: 2, pageSize: 2 })
    expect(result.data).toHaveLength(2)
    expect(result.data[0].id).toBe('p2')
    expect(result.page).toBe(2)
    expect(result.total).toBe(5)
  })
})

describe('update', () => {
  it('sempre inclui tenantId no WHERE via updateMany', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.product.findFirst).mockResolvedValue(makeProduct() as any)

    await repo.update('tenant-B', 'prod-1', { name: 'Novo Nome' })

    expect(prisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'prod-1', tenantId: 'tenant-B' }),
      }),
    )
  })
})

describe('softDelete', () => {
  it('sempre inclui tenantId no WHERE', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 })
    await repo.softDelete('tenant-C', 'prod-2')
    expect(prisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'prod-2', tenantId: 'tenant-C' }),
      }),
    )
  })
})

describe('incrementStock / decrementStock', () => {
  it('usa increment do Prisma com tenantId', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 })
    await repo.incrementStock('t1', 'p1', 10)
    expect(prisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', id: 'p1' }),
        data: { stockQuantity: { increment: 10 } },
      }),
    )
  })

  it('usa decrement do Prisma com tenantId', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 })
    await repo.decrementStock('t1', 'p1', 3)
    expect(prisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', id: 'p1' }),
        data: { stockQuantity: { decrement: 3 } },
      }),
    )
  })
})

describe('deleteCategory', () => {
  it('sempre inclui tenantId no WHERE via deleteMany', async () => {
    vi.mocked(prisma.productCategory.deleteMany).mockResolvedValue({ count: 1 })
    await repo.deleteCategory('tenant-D', 'cat-1')
    expect(prisma.productCategory.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'cat-1', tenantId: 'tenant-D' }),
      }),
    )
  })
})
