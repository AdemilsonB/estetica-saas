import type { Customer, Prisma } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export type CustomerFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export class CustomerRepository {
  async findAll(tenantId: string, filters: CustomerFilters = {}) {
    const { search, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return { data, total, page, pageSize };
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

  async findByPhones(tenantId: string, phones: string[]): Promise<Customer[]> {
    if (phones.length === 0) return [];
    return prisma.customer.findMany({
      where: { tenantId, phone: { in: phones } },
    });
  }

  async create(
    tenantId: string,
    data: Omit<Prisma.CustomerUncheckedCreateInput, "tenantId">,
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

  async findWithAppointments(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        appointments: {
          include: {
            service: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
          },
          orderBy: { startsAt: 'desc' },
          take: 50,
        },
      },
    })
  }
}

export const customerRepository = new CustomerRepository();
