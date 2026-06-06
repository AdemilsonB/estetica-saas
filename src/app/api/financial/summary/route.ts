import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { FINANCIAL_CATEGORIES, isReversal } from "@/domains/financial/categories";

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
    const commissions = income.reduce((s, t) => s + Number(t.commissionAmount ?? 0), 0);

    const isReversalTx = (t: (typeof transactions)[0]) =>
      isReversal(t.category, Number(t.amount));

    const supplyExpenses = expenses
      .filter((t) => t.category === FINANCIAL_CATEGORIES.SUPPLY_USE && !isReversalTx(t))
      .reduce((s, t) => s + Number(t.amount), 0);

    const supplyReversals = expenses
      .filter(isReversalTx)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    const netSupplyCost = Math.max(0, supplyExpenses - supplyReversals);

    const stockPurchases = expenses
      .filter((t) => t.category === FINANCIAL_CATEGORIES.STOCK_PURCHASE && !isReversalTx(t))
      .reduce((s, t) => s + Number(t.amount), 0);

    const courtesies = expenses
      .filter((t) => t.category === FINANCIAL_CATEGORIES.COURTESY && !isReversalTx(t))
      .reduce((s, t) => s + Number(t.amount), 0);

    const operationalExpenses = expenses
      .filter(
        (t) =>
          !isReversalTx(t) &&
          t.category !== FINANCIAL_CATEGORIES.SUPPLY_USE &&
          t.category !== FINANCIAL_CATEGORIES.STOCK_PURCHASE &&
          t.category !== FINANCIAL_CATEGORIES.COURTESY,
      )
      .reduce((s, t) => s + Number(t.amount), 0);

    const totalExpenses = netSupplyCost + stockPurchases + courtesies + operationalExpenses;
    const profit = netRevenue - totalExpenses;

    return Response.json({
      grossRevenue,
      discounts,
      tips,
      cardFees,
      netRevenue,
      supplyExpenses,
      supplyReversals,
      netSupplyCost,
      stockPurchases,
      courtesies,
      operationalExpenses,
      totalExpenses,
      profit,
      commissions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
