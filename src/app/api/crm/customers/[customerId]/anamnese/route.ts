import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { anamneseService } from "@/domains/crm/anamnese.service";
import { saveAnamneseSchema } from "@/domains/crm/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.view);
    const { customerId } = await params;
    const anamnese = await anamneseService.getAnamnese(session.tenantId, customerId);
    return Response.json(anamnese ?? null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.edit);
    const { customerId } = await params;
    const input = await validateInput(request, saveAnamneseSchema);
    const anamnese = await anamneseService.saveAnamnese(
      session.tenantId,
      customerId,
      input.data,
    );
    return Response.json(anamnese);
  } catch (error) {
    return handleApiError(error);
  }
}
