import { customerService } from "@/domains/crm/customer.service";
import { createCustomerSchema, listCustomersSchema } from "@/domains/crm/types";
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

    const { searchParams } = new URL(request.url);
    const filters = listCustomersSchema.parse({
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      onlyVip: searchParams.get("onlyVip") ?? undefined,
      birthdayMonth: searchParams.get("birthdayMonth") ?? undefined,
      noAppointmentDays: searchParams.get("noAppointmentDays") ?? undefined,
      minAvgTicket: searchParams.get("minAvgTicket") ?? undefined,
      hasPendingDebt: searchParams.get("hasPendingDebt") ?? undefined,
    });

    const result = await customerService.list(session.tenantId, filters);
    return Response.json(result);
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
