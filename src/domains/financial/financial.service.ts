import { Prisma } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";

import { transactionRepository, type TransactionFilters } from "./transaction.repository";
import type { CreateTransactionInput } from "./types";

export class FinancialService {
  async list(tenantId: string, filters?: TransactionFilters) {
    return transactionRepository.list(tenantId, filters);
  }

  async create(tenantId: string, input: CreateTransactionInput) {
    const transaction = await transactionRepository.create(tenantId, {
      appointmentId: input.appointmentId,
      type: input.type,
      category: input.category,
      description: input.description,
      amount: new Prisma.Decimal(input.amount),
      paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
    });

    eventBus.publish({
      type: "financial.transaction.created",
      payload: { tenantId, transaction },
    });

    return transaction;
  }
}

export const financialService = new FinancialService();
