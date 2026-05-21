import { customerService } from "@/domains/crm/customer.service";
import { updateCustomerSchema } from "@/domains/crm/types";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.edit);
    const { customerId } = await context.params;
    const input = await validateInput(request, updateCustomerSchema);
    const customer = await customerService.update(
      session.tenantId,
      customerId,
      input,
    );
    return Response.json(customer);
  } catch (error) {
    return handleApiError(error);
  }
}
