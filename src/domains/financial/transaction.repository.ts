import { type Prisma, TransactionType, type Transaction } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export type TransactionFilters = {
  type?: TransactionType;
  category?: string;
  professionalId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export class TransactionRepository {
  async list(tenantId: string, filters: TransactionFilters = {}) {
    const { type, category, professionalId, from, to, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.TransactionWhereInput = {
      tenantId,
      ...(type && { type }),
      ...(category && { category }),
      ...(professionalId && { professionalId }),
      ...(from || to
        ? {
            paidAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async create(
    tenantId: string,
    data: Omit<Prisma.TransactionUncheckedCreateInput, "tenantId">,
  ): Promise<Transaction> {
    return prisma.transaction.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async findByAppointmentId(
    tenantId: string,
    appointmentId: string,
    filters: { type?: TransactionType; category?: string } = {},
  ): Promise<Transaction[]> {
    return prisma.transaction.findMany({
      where: { tenantId, appointmentId, ...filters },
    });
  }
}

export const transactionRepository = new TransactionRepository();
