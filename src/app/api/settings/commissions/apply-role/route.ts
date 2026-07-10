import { z } from "zod";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { commissionRepository } from "@/domains/financial/commission.repository";

const applyRoleSchema = z.object({
  roleId: z.string().cuid(),
  rate: z.number().min(0).max(100),
});

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "comissoes", "edit");
    const input = await validateInput(request, applyRoleSchema);
    const result = await commissionRepository.applyRateToRole(
      session.tenantId, input.roleId, input.rate,
    );
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
