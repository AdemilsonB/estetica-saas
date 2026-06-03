import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { PromotionRepository } from '../promotion.repository'
import { Prisma, PromoDiscountType } from '@prisma/client'

const repo = new PromotionRepository()

const futureDate = new Date(Date.now() + 86400000)
const pastDate = new Date(Date.now() - 86400000)

const makePromo = (overrides: Record<string, unknown> = {}) => ({
  id: 'promo-1',
  tenantId: 'tenant-1',
  name: '20% off corte',
  description: null,
  discountType: PromoDiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal('20.00'),
  startsAt: null,
  endsAt: null,
  active: true,
  imageUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
  ...overrides,
})

describe('PromotionRepository', () => {
  beforeEach(() => {
    prismaMock.promotion.findMany.mockResolvedValue([makePromo()] as never)
    prismaMock.promotion.findFirst.mockResolvedValue(makePromo() as never)
    prismaMock.promotion.create.mockResolvedValue(makePromo() as never)
    prismaMock.promotion.update.mockResolvedValue(makePromo() as never)
  })

  it('list() filtra por tenantId', async () => {
    await repo.list('tenant-1')
    expect(prismaMock.promotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    )
  })

  it('list() retorna expired: false quando endsAt é null', async () => {
    prismaMock.promotion.findMany.mockResolvedValue([makePromo({ endsAt: null })] as never)
    const result = await repo.list('tenant-1')
    expect(result[0].expired).toBe(false)
  })

  it('list() retorna expired: true quando endsAt está no passado', async () => {
    prismaMock.promotion.findMany.mockResolvedValue([makePromo({ endsAt: pastDate })] as never)
    const result = await repo.list('tenant-1')
    expect(result[0].expired).toBe(true)
  })

  it('list() retorna expired: false quando endsAt está no futuro', async () => {
    prismaMock.promotion.findMany.mockResolvedValue([makePromo({ endsAt: futureDate })] as never)
    const result = await repo.list('tenant-1')
    expect(result[0].expired).toBe(false)
  })

  it('create() injeta tenantId', async () => {
    await repo.create('tenant-1', {
      name: '20% off',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      items: [{ serviceId: 'svc-1' }],
    })
    expect(prismaMock.promotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', name: '20% off' }),
      }),
    )
  })

  it('deactivate() seta active: false', async () => {
    await repo.deactivate('tenant-1', 'promo-1')
    expect(prismaMock.promotion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'promo-1', tenantId: 'tenant-1' },
        data: { active: false },
      }),
    )
  })
})
