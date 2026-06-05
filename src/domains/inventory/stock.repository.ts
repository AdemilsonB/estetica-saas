import { Prisma, StockMovementType } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import type { ListMovementsQuery } from './types'

type CreateMovementData = {
  productId: string
  type: StockMovementType
  quantity: number
  unitPrice?: Prisma.Decimal
  totalAmount?: Prisma.Decimal
  notes?: string
  appointmentId?: string
  createdByUserId: string
}

export class StockRepository {
  async create(tenantId: string, data: CreateMovementData) {
    return prisma.stockMovement.create({
      data: { tenantId, ...data },
      include: { product: true },
    })
  }

  async list(tenantId: string, filters: ListMovementsQuery) {
    const { type, productId, from, to, page = 1, pageSize = 20 } = filters
    const skip = (page - 1) * pageSize

    const where: Prisma.StockMovementWhereInput = {
      tenantId,
      ...(type && { type }),
      ...(productId && { productId }),
      ...(from || to ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ])

    return { data, total, page, pageSize }
  }
}

export const stockRepository = new StockRepository()
