import type { Customer, Prisma } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class CustomerRepository {
  async findAll(tenantId: string) {
    return prisma.customer.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
  }

  async findByPhone(tenantId: string, phone: string) {
    return prisma.customer.findFirst({
      where: { tenantId, phone },
    });
  }

  async create(
    tenantId: string,
    data: Prisma.CustomerUncheckedCreateInput,
  ): Promise<Customer> {
    return prisma.customer.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async update(
    tenantId: string,
    customerId: string,
    data: Prisma.CustomerUpdateInput,
  ) {
    await prisma.customer.updateMany({
      where: { id: customerId, tenantId },
      data,
    });

    return prisma.customer.findFirstOrThrow({
      where: { id: customerId, tenantId },
    });
  }
}

export const customerRepository = new CustomerRepository();
