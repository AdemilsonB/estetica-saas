import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { customerMessageSettingService } from "@/domains/notifications/customer-messages/customer-message-setting.service";
import { updateCustomerMessageSettingSchema } from "@/domains/notifications/customer-messages/schemas";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const items = await customerMessageSettingService.resolveAll(session.tenantId);
    return Response.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const input = await validateInput(request, updateCustomerMessageSettingSchema);

    // tenantId vem SEMPRE da sessão — nunca do body.
    const salvo = await customerMessageSettingService.save(session.tenantId, input);
    return Response.json(salvo);
  } catch (error) {
    return handleApiError(error);
  }
}
