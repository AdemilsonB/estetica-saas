import { z } from "zod";
import { RecurrenceType } from "@prisma/client";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { recurringExpenseRepository } from "@/domains/financial/recurring-expense.repository";

const createSchema = z.object({
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(200),
  amount: z.number().positive(),
  recurrenceType: z.nativeEnum(RecurrenceType),
  nextDueDate: z.string().datetime(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.view);
    const result = await recurringExpenseRepository.list(session.tenantId);
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
    const input = await validateInput(request, createSchema);
    const result = await recurringExpenseRepository.create(session.tenantId, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
