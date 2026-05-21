import { type Prisma, TransactionType, type Transaction } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export type TransactionFilters = {
  type?: TransactionType;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export class TransactionRepository {
  async list(tenantId: string, filters: TransactionFilters = {}) {
    const { type, from, to, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.TransactionWhereInput = {
      tenantId,
      ...(type && { type }),
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
        include: { appointment: true },
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
    data: Prisma.TransactionUncheckedCreateInput,
  ): Promise<Transaction> {
    return prisma.transaction.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }
}

export const transactionRepository = new TransactionRepository();
