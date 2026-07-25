import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { customerService } from "@/domains/crm/customer.service";
import { importCustomersSchema } from "@/domains/crm/types";

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.create);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const input = await validateInput(request, importCustomersSchema);

    const result = await customerService.importCustomers(
      session.tenantId,
      input.customers,
      "whatsapp_import",
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
