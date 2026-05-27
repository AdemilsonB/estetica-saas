import { z } from "zod";

import { availabilityService } from "@/domains/scheduling/availability.service";
import { catalogServiceRepository } from "@/domains/scheduling/service.repository";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { ValidationError } from "@/shared/errors";

const querySchema = z.object({
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().cuid(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.create);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw new ValidationError("Parametros invalidos.", parsed.error.flatten());
    }

    const { professionalId, date, serviceId } = parsed.data;

    const service = await catalogServiceRepository.findById(session.tenantId, serviceId);
    if (!service) {
      return Response.json({ slots: [] });
    }

    const slots = await availabilityService.getAvailableSlots(
      session.tenantId,
      professionalId,
      date,
      service.duration,
    );

    return Response.json({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}
