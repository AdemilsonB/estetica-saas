import { z } from "zod";
import { customerRepository } from "@/domains/crm/customer.repository";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const previewSchema = z.object({
  phones: z.array(z.string().min(1)).max(500),
});

export async function POST(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.view);

    const { phones } = await validateInput(request, previewSchema);
    const existing = await customerRepository.findByPhones(session.tenantId, phones);
    const existingPhones = existing
      .map((c) => c.phone)
      .filter((p): p is string => p !== null);

    return Response.json({ existing: existingPhones });
  } catch (error) {
    return handleApiError(error);
  }
}
