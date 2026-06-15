import type { Prisma, PriceType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class CatalogServiceRepository {
  async list(tenantId: string) {
    return prisma.service.findMany({
      where: { tenantId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findById(tenantId: string, serviceId: string) {
    return prisma.service.findFirst({
      where: { id: serviceId, tenantId },
    });
  }

  async findByCatalogId(tenantId: string, catalogServiceId: string) {
    return prisma.service.findFirst({
      where: { tenantId, catalogServiceId },
    })
  }

  async create(
    tenantId: string,
    data: Omit<Prisma.ServiceUncheckedCreateInput, 'tenantId'>,
  ) {
    return prisma.service.create({
      data: { ...data, tenantId },
      include: { category: { select: { id: true, name: true } } },
    })
  }

  async update(
    tenantId: string,
    serviceId: string,
    data: {
      name?: string
      duration?: number
      price?: number | Prisma.Decimal
      priceType?: PriceType
      priceMin?: number | Prisma.Decimal | null
      priceMax?: number | Prisma.Decimal | null
      description?: string | null
      categoryId?: string | null
      imageUrl?: string | null
    },
  ) {
    return prisma.service.update({
      where: { id: serviceId, tenantId },
      data,
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async deactivate(tenantId: string, serviceId: string) {
    return prisma.service.update({
      where: { id: serviceId, tenantId },
      data: { active: false },
    });
  }
}

export const catalogServiceRepository = new CatalogServiceRepository();
