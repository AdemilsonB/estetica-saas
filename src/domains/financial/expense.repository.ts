import { Prisma, TransactionType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export type CreateExpenseInput = {
  category: string;
  description: string;
  amount: number;
  paidAt?: string;
};

export class ExpenseRepository {
  async list(tenantId: string, filters: { from?: Date; to?: Date; page?: number; limit?: number } = {}) {
    const { from, to, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.TransactionWhereInput = {
      tenantId,
      type: TransactionType.EXPENSE,
      ...(from || to ? { paidAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.transaction.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async create(tenantId: string, input: CreateExpenseInput) {
    return prisma.transaction.create({
      data: {
        tenantId,
        type: TransactionType.EXPENSE,
        category: input.category,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    return prisma.transaction.deleteMany({ where: { id, tenantId, type: TransactionType.EXPENSE } });
  }
}

export const expenseRepository = new ExpenseRepository();
