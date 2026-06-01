import { Prisma } from "@prisma/client";
import type { RecurrenceType } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";

export type CreateRecurringExpenseInput = {
  category: string;
  description: string;
  amount: number;
  recurrenceType: RecurrenceType;
  nextDueDate: string;
};

export class RecurringExpenseRepository {
  async list(tenantId: string) {
    return prisma.recurringExpense.findMany({
      where: { tenantId },
      orderBy: { nextDueDate: "asc" },
    });
  }

  async create(tenantId: string, input: CreateRecurringExpenseInput) {
    return prisma.recurringExpense.create({
      data: {
        tenantId,
        category: input.category,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        recurrenceType: input.recurrenceType,
        nextDueDate: new Date(input.nextDueDate),
      },
    });
  }

  async update(tenantId: string, id: string, data: Partial<CreateRecurringExpenseInput> & { active?: boolean; nextDueDate?: string | Date }) {
    return prisma.recurringExpense.updateMany({
      where: { id, tenantId },
      data: {
        ...(data.category && { category: data.category }),
        ...(data.description && { description: data.description }),
        ...(data.amount !== undefined && { amount: new Prisma.Decimal(data.amount) }),
        ...(data.recurrenceType && { recurrenceType: data.recurrenceType }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.nextDueDate && { nextDueDate: new Date(data.nextDueDate) }),
      },
    });
  }

  async findDueToday() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return prisma.recurringExpense.findMany({
      where: { active: true, nextDueDate: { lte: today } },
    });
  }
}

export const recurringExpenseRepository = new RecurringExpenseRepository();
