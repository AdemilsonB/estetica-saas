import { z } from "zod";
import { RecurrenceType } from "@prisma/client";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { recurringExpenseRepository } from "@/domains/financial/recurring-expense.repository";

const patchSchema = z.object({
  category: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().min(2).max(200).optional(),
  amount: z.number().positive().optional(),
  recurrenceType: z.nativeEnum(RecurrenceType).optional(),
  nextDueDate: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.manage);
    const { id } = await params;
    const input = await validateInput(request, patchSchema);
    await recurringExpenseRepository.update(session.tenantId, id, input);
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
