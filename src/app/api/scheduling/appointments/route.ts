import { schedulingService } from "@/domains/scheduling/scheduling.service";
import { createAppointmentSchema, listAppointmentsSchema } from "@/domains/scheduling/types";
import { type AppointmentFilters } from "@/domains/scheduling/appointment.repository";
import { AppointmentStatus } from "@prisma/client";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { ForbiddenError } from "@/shared/errors";
import { handleApiError } from "@/shared/http/handle-api-error";
import { created } from "@/shared/http/responses";
import { validateInput } from "@/shared/http/validate-input";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.view);

    const { searchParams } = new URL(request.url);
    const query = listAppointmentsSchema.parse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      professionalId: searchParams.get("professionalId") ?? undefined,
    });

    const filters: AppointmentFilters = {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      status: query.status as AppointmentStatus | undefined,
      professionalId: query.professionalId,
    };

    const appointments = await schedulingService.listAppointments(session.tenantId, filters);
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

    if (input.allowOverlap && session.role !== 'OWNER' && session.role !== 'MANAGER') {
      throw new ForbiddenError("Apenas OWNER e MANAGER podem autorizar conflito de horario.");
    }

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
