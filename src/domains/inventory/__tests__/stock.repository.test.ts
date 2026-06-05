import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/shared/database/prisma'
import { StockRepository } from '../stock.repository'

const repo = new StockRepository()

beforeEach(() => vi.clearAllMocks())

describe('list', () => {
  it('sempre filtra por tenantId', async () => {
    vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockMovement.count).mockResolvedValue(0)

    await repo.list('tenant-X', { page: 1, pageSize: 20 })

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-X' }),
      }),
    )
  })

  it('aplica filtro por tipo de movimentação', async () => {
    vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockMovement.count).mockResolvedValue(0)

    await repo.list('t1', { type: 'PURCHASE', page: 1, pageSize: 20 })

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'PURCHASE' }),
      }),
    )
  })

  it('retorna paginação correta', async () => {
    vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockMovement.count).mockResolvedValue(42)

    const result = await repo.list('t1', { page: 2, pageSize: 10 })

    expect(result.total).toBe(42)
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(10)
    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    )
  })

  it('aplica filtro por período quando from e to estão presentes', async () => {
    vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockMovement.count).mockResolvedValue(0)

    await repo.list('t1', {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.000Z',
      page: 1,
      pageSize: 20,
    })

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.000Z'),
          },
        }),
      }),
    )
  })
})

describe('create', () => {
  it('sempre inclui tenantId no data', async () => {
    vi.mocked(prisma.stockMovement.create).mockResolvedValue({} as any)

    await repo.create('tenant-Y', {
      productId: 'p1',
      type: 'PURCHASE',
      quantity: 10,
      createdByUserId: 'u1',
    })

    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-Y', productId: 'p1' }),
      }),
    )
  })
})
