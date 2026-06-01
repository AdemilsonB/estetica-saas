import { z } from "zod";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { commissionRepository } from "@/domains/financial/commission.repository";

const upsertSchema = z.object({
  serviceId: z.string().cuid(),
  professionalId: z.string().uuid(),
  rate: z.number().min(0).max(100),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const result = await commissionRepository.listByTenant(session.tenantId);
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, upsertSchema);
    const result = await commissionRepository.upsert(
      session.tenantId, input.serviceId, input.professionalId, input.rate,
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
