import { Prisma, PromoDiscountType } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

const INCLUDE = {
  items: {
    include: {
      service: { select: { id: true, name: true, price: true, duration: true } },
      package: { select: { id: true, name: true, price: true } },
    },
  },
}

type PromoItemInput = { serviceId?: string; packageId?: string }

type CreatePromotionData = {
  name: string
  description?: string
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  startsAt?: string
  endsAt?: string
  imageUrl?: string
  items: PromoItemInput[]
}

type UpdatePromotionData = {
  name?: string
  description?: string
  discountType?: 'PERCENTAGE' | 'FIXED'
  discountValue?: number
  startsAt?: string | null
  endsAt?: string | null
  active?: boolean
  imageUrl?: string | null
  imageCropX?: number | null
  imageCropY?: number | null
  imageCropZoom?: number | null
  items?: PromoItemInput[]
}

function withExpired<T extends { endsAt: Date | null }>(promo: T) {
  return { ...promo, expired: promo.endsAt !== null && promo.endsAt < new Date() }
}

export class PromotionRepository {
  async list(tenantId: string) {
    const rows = await prisma.promotion.findMany({
      where: { tenantId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(withExpired)
  }

  async findById(tenantId: string, promotionId: string) {
    const row = await prisma.promotion.findFirst({
      where: { id: promotionId, tenantId },
      include: INCLUDE,
    })
    return row ? withExpired(row) : null
  }

  async create(tenantId: string, data: CreatePromotionData) {
    const row = await prisma.promotion.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        discountType: data.discountType as PromoDiscountType,
        discountValue: new Prisma.Decimal(data.discountValue),
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        imageUrl: data.imageUrl,
        items: {
          create: data.items.map((i) => ({ serviceId: i.serviceId, packageId: i.packageId })),
        },
      },
      include: INCLUDE,
    })
    return withExpired(row)
  }

  async update(tenantId: string, promotionId: string, data: UpdatePromotionData) {
    return prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.promotionItem.deleteMany({ where: { promotionId } })
        await tx.promotionItem.createMany({
          data: data.items.map((i) => ({
            promotionId,
            serviceId: i.serviceId,
            packageId: i.packageId,
          })),
        })
      }
      const row = await tx.promotion.update({
        where: { id: promotionId, tenantId },
        data: {
          name: data.name,
          description: data.description,
          discountType: data.discountType as PromoDiscountType | undefined,
          discountValue:
            data.discountValue !== undefined ? new Prisma.Decimal(data.discountValue) : undefined,
          startsAt:
            data.startsAt !== undefined
              ? data.startsAt
                ? new Date(data.startsAt)
                : null
              : undefined,
          endsAt:
            data.endsAt !== undefined ? (data.endsAt ? new Date(data.endsAt) : null) : undefined,
          active: data.active,
          imageUrl: data.imageUrl,
          imageCropX: data.imageCropX,
          imageCropY: data.imageCropY,
          imageCropZoom: data.imageCropZoom,
        },
        include: INCLUDE,
      })
      return withExpired(row)
    })
  }

  async deactivate(tenantId: string, promotionId: string) {
    return prisma.promotion.update({
      where: { id: promotionId, tenantId },
      data: { active: false },
    })
  }
}

export const promotionRepository = new PromotionRepository()
