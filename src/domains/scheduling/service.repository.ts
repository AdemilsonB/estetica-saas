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
    data: Prisma.ServiceUncheckedCreateInput,
  ): Promise<Service> {
    return prisma.service.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }
}

export const catalogServiceRepository = new CatalogServiceRepository();
