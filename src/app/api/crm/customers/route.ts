import { customerService } from "@/domains/crm/customer.service";
import { createCustomerSchema } from "@/domains/crm/types";
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
    ensurePermission(session, PERMISSIONS.customers.view);
    const customers = await customerService.list(session.tenantId);
    return Response.json(customers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.create);
    const input = await validateInput(request, createCustomerSchema);
    const customer = await customerService.create(session.tenantId, input);
    return created(customer);
  } catch (error) {
    return handleApiError(error);
  }
}
