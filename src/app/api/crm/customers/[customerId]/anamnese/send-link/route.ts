import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { anamneseService } from "@/domains/crm/anamnese.service";
import { sendAnamnaseLinkSchema } from "@/domains/crm/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.edit);
    const { customerId } = await params;
    const input = await validateInput(request, sendAnamnaseLinkSchema);
    const result = await anamneseService.sendLink(
      session.tenantId,
      customerId,
      input.message,
    );
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
