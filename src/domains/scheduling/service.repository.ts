import type { Prisma, Service } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class CatalogServiceRepository {
  async list(tenantId: string) {
    return prisma.service.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  async findById(tenantId: string, serviceId: string) {
    return prisma.service.findFirst({
      where: { id: serviceId, tenantId },
    });
  }

  async create(
    tenantId: string,
    data: Omit<Prisma.ServiceUncheckedCreateInput, "tenantId">,
  ): Promise<Service> {
    return prisma.service.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async update(
    tenantId: string,
    serviceId: string,
    data: { name?: string; duration?: number; price?: number },
  ) {
    return prisma.service.update({
      where: { id: serviceId, tenantId },
      data,
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
