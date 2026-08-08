import { schedulingService } from "@/domains/scheduling/scheduling.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.view);

    const canViewAll = session.isOwner || session.permissions["agenda"]?.includes("view_all");
    const appointments = await schedulingService.listPendingCompletion(session.tenantId, {
      professionalId: canViewAll ? undefined : session.userId,
    });

    return Response.json(appointments);
  } catch (error) {
    return handleApiError(error);
  }
}
