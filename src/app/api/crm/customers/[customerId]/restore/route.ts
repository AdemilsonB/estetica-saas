import { customerService } from "@/domains/crm/customer.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.edit);
    const { customerId } = await context.params;
    const customer = await customerService.restore(session.tenantId, customerId);
    return Response.json(customer);
  } catch (error) {
    return handleApiError(error);
  }
}
