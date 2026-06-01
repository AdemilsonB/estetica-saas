import { z } from "zod";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { expenseRepository } from "@/domains/financial/expense.repository";

const createExpenseSchema = z.object({
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(200),
  amount: z.number().positive(),
  paidAt: z.string().datetime().optional(),
});

const listSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.view);
    const url = new URL(request.url);
    const query = listSchema.parse(Object.fromEntries(url.searchParams));
    const result = await expenseRepository.list(session.tenantId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.manage);
    const input = await validateInput(request, createExpenseSchema);
    const result = await expenseRepository.create(session.tenantId, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
