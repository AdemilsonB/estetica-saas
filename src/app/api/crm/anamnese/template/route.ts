import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { anamneseService } from "@/domains/crm/anamnese.service";
import { updateAnamneseTemplateSchema } from "@/domains/crm/types";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const template = await anamneseService.getTemplate(session.tenantId);
    return Response.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, updateAnamneseTemplateSchema);
    const template = await anamneseService.updateTemplate(session.tenantId, input);
    return Response.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}
