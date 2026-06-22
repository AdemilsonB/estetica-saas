import type { PgBoss, Job } from "pg-boss";
import { Prisma, TransactionType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export const RECURRING_EXPENSE_JOB = "recurring-expense-processor";

export async function handleRecurringExpense(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const due = await prisma.recurringExpense.findMany({
    where: { active: true, nextDueDate: { lte: now } },
  });

  if (due.length === 0) return;

  const paidAt = new Date();
  const operations = due.flatMap((expense) => {
    const next = new Date(expense.nextDueDate);
    if (expense.recurrenceType === "MONTHLY") {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }

    return [
      prisma.transaction.create({
        data: {
          tenantId: expense.tenantId,
          type: TransactionType.EXPENSE,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          paidAt,
        },
      }),
      prisma.recurringExpense.update({
        where: { id: expense.id },
        data: { nextDueDate: next },
      }),
    ];
  });

  await prisma.$transaction(operations);
}

export async function registerRecurringExpenseJob(boss: PgBoss): Promise<void> {
  await boss.schedule(RECURRING_EXPENSE_JOB, "0 6 * * *", {});
  boss.work(RECURRING_EXPENSE_JOB, handleRecurringExpense);
}
