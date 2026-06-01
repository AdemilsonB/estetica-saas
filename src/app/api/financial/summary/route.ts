import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.view);
    const url = new URL(request.url);
    const { from, to } = querySchema.parse(Object.fromEntries(url.searchParams));

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: session.tenantId,
        paidAt: { gte: new Date(from), lte: new Date(to) },
      },
    });

    const income = transactions.filter((t) => t.type === TransactionType.INCOME);
    const expenses = transactions.filter((t) => t.type === TransactionType.EXPENSE);

    const grossRevenue = income.reduce((s, t) => s + Number(t.grossAmount ?? t.amount), 0);
    const discounts = income.reduce((s, t) => s + Number(t.discountAmount ?? 0), 0);
    const tips = income.reduce((s, t) => s + Number(t.tipAmount ?? 0), 0);
    const cardFees = income.reduce((s, t) => s + Number(t.cardFeeAmount ?? 0), 0);
    const netRevenue = income.reduce((s, t) => s + Number(t.netAmount ?? t.amount), 0);
    const variableExpenses = expenses
      .filter((t) => t.category !== "cortesia")
      .reduce((s, t) => s + Number(t.amount), 0);
    const fixedExpenses = 0;
    const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const profit = netRevenue - totalExpenses;
    const commissions = income.reduce((s, t) => s + Number(t.commissionAmount ?? 0), 0);

    return Response.json({
      grossRevenue, discounts, tips, cardFees, netRevenue,
      variableExpenses, fixedExpenses, totalExpenses, profit, commissions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
