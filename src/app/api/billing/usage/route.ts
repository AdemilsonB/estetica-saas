import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { getTenantUsage } from "@/domains/billing/usage.service";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    const items = await getTenantUsage(session.tenantId);
    return Response.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
