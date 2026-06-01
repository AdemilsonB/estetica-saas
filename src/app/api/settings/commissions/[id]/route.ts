import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { commissionRepository } from "@/domains/financial/commission.repository";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const { id } = await params;
    await commissionRepository.delete(session.tenantId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
