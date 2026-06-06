import { financialService } from "@/domains/financial/financial.service";
import { createTransactionSchema, listTransactionsSchema } from "@/domains/financial/types";
import { TransactionType } from "@prisma/client";
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

    const { searchParams } = new URL(request.url);
    const query = listTransactionsSchema.parse({
      type: searchParams.get("type") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      professionalId: searchParams.get("professionalId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    const result = await financialService.list(session.tenantId, {
      type: query.type as TransactionType | undefined,
      category: query.category,
      professionalId: query.professionalId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
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
    const input = await validateInput(request, createTransactionSchema);
    const transaction = await financialService.create(session.tenantId, input);
    return created(transaction);
  } catch (error) {
    return handleApiError(error);
  }
}
