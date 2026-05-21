import { financialService } from "@/domains/financial/financial.service";
import { createTransactionSchema } from "@/domains/financial/types";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { created } from "@/shared/http/responses";
import { validateInput } from "@/shared/http/validate-input";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.view);
    const transactions = await financialService.list(session.tenantId);
    return Response.json(transactions);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.manage);
    const input = await validateInput(request, createTransactionSchema);
    const transaction = await financialService.create(session.tenantId, input);
    return created(transaction);
  } catch (error) {
    return handleApiError(error);
  }
}
