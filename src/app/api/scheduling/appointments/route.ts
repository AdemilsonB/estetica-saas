import { schedulingService } from "@/domains/scheduling/scheduling.service";
import { createAppointmentSchema } from "@/domains/scheduling/types";
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
    ensurePermission(session, PERMISSIONS.appointments.view);
    const appointments = await schedulingService.listAppointments(session.tenantId);
    return Response.json(appointments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.create);
    const input = await validateInput(request, createAppointmentSchema);
    const appointment = await schedulingService.createAppointment(
      session.tenantId,
      session.userId,
      input,
    );
    return created(appointment);
  } catch (error) {
    return handleApiError(error);
  }
}
