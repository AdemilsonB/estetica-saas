import type { Prisma, Transaction } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class TransactionRepository {
  async list(tenantId: string) {
    return prisma.transaction.findMany({
      where: { tenantId },
      include: {
        appointment: true,
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });
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
