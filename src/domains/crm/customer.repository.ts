import type { Customer, Prisma } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export type CustomerFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  onlyVip?: boolean;
  birthdayMonth?: number;
  noAppointmentDays?: number;
  minAvgTicket?: number;
  hasPendingDebt?: boolean;
};

export class CustomerRepository {
  async findAll(tenantId: string, filters: CustomerFilters = {}) {
    const {
      search,
      page = 1,
      pageSize = 20,
      onlyVip,
      birthdayMonth,
      noAppointmentDays,
      minAvgTicket,
      hasPendingDebt,
    } = filters;
    const skip = (page - 1) * pageSize;

    // Filtros complexos via raw SQL — retornam conjuntos de IDs
    const rawSets: string[][] = [];

    if (birthdayMonth != null) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Customer"
        WHERE "tenantId" = ${tenantId}
        AND "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${birthdayMonth}
      `;
      rawSets.push(rows.map((r) => r.id));
    }

    if (noAppointmentDays != null) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM "Customer" c
        WHERE c."tenantId" = ${tenantId}
        AND NOT EXISTS (
          SELECT 1 FROM "Appointment" a
          WHERE a."customerId" = c.id
          AND a."tenantId" = ${tenantId}
          AND a.status = 'COMPLETED'::"AppointmentStatus"
          AND a."startsAt" >= NOW() - (${noAppointmentDays}::integer * INTERVAL '1 day')
        )
      `;
      rawSets.push(rows.map((r) => r.id));
    }

    if (minAvgTicket != null) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT a."customerId" AS id
        FROM "Transaction" t
        JOIN "Appointment" a ON a.id = t."appointmentId"
        WHERE t."tenantId" = ${tenantId}
        AND t.type = 'INCOME'::"TransactionType"
        AND t."paidAt" >= NOW() - INTERVAL '365 days'
        AND a."customerId" IS NOT NULL
        GROUP BY a."customerId"
        HAVING AVG(t.amount) >= ${minAvgTicket}
      `;
      rawSets.push(rows.map((r) => r.id));
    }

    if (hasPendingDebt) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT a."customerId" AS id
        FROM "Appointment" a
        WHERE a."tenantId" = ${tenantId}
        AND a."paymentStatus" IN (
          'PENDING'::"AppointmentPaymentStatus",
          'DEBT'::"AppointmentPaymentStatus"
        )
      `;
      rawSets.push(rows.map((r) => r.id));
    }

    // Interseção dos conjuntos — cliente deve passar em TODOS os filtros ativos
    let complexIds: string[] | null = null;
    if (rawSets.length > 0) {
      const [first, ...rest] = rawSets;
      complexIds = rest.reduce((acc, set) => {
        const s = new Set(set);
        return acc.filter((id) => s.has(id));
      }, first);
    }

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(complexIds !== null && { id: { in: complexIds } }),
      ...(onlyVip && { isVip: true }),
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
      data: { ...data, tenantId },
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
          orderBy: { startsAt: "desc" },
          take: 50,
        },
      },
    });
  }

  async findByIdWithStats(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        appointments: {
          include: {
            service: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
          },
          orderBy: { startsAt: "desc" },
          take: 50,
        },
        _count: {
          select: {
            appointments: { where: { status: "NO_SHOW" } },
          },
        },
      },
    });
  }
}

export const customerRepository = new CustomerRepository();
