import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { schedulingService } from "@/domains/scheduling/scheduling.service";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.manage);
    const { appointmentId } = await context.params;
    await schedulingService.refundPayment(session.tenantId, appointmentId);
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
