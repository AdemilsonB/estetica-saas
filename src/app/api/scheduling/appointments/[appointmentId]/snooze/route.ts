import { schedulingService } from "@/domains/scheduling/scheduling.service";
import { snoozeAppointmentCompletionSchema } from "@/domains/scheduling/types";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.edit);
    const { appointmentId } = await context.params;
    const input = await validateInput(request, snoozeAppointmentCompletionSchema);
    const appointment = await schedulingService.snoozeCompletion(
      session.tenantId,
      appointmentId,
      input.days,
    );
    return Response.json(appointment);
  } catch (error) {
    return handleApiError(error);
  }
}
