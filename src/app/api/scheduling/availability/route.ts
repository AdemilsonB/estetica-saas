import { z } from "zod";

import { prisma } from "@/shared/database/prisma";
import { availabilityService } from "@/domains/scheduling/availability.service";
import { catalogServiceRepository } from "@/domains/scheduling/service.repository";
import { schedulingPolicyService } from "@/domains/scheduling/scheduling-policy.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { ValidationError } from "@/shared/errors";

const querySchema = z.object({
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().cuid().optional(),
  packageId: z.string().cuid().optional(),
}).refine((d) => d.serviceId || d.packageId, { message: 'serviceId ou packageId obrigatório' });

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

    const { professionalId, date, serviceId, packageId } = parsed.data;
    const policy = await schedulingPolicyService.getPolicy(session.tenantId);

    let duration: number;
    if (packageId) {
      const pkg = await prisma.servicePackage.findFirst({
        where: { id: packageId, tenantId: session.tenantId },
        include: { items: { include: { service: { select: { duration: true } } } } },
      });
      if (!pkg) return Response.json({ slots: [] });
      duration = pkg.items.reduce((s, i) => s + i.service.duration, 0) || 60;
    } else {
      const service = await catalogServiceRepository.findById(session.tenantId, serviceId!);
      if (!service) return Response.json({ slots: [] });
      duration = service.duration;
    }

    // minAdvanceMinutes/maxAdvanceDays não se aplicam ao painel — só ao fluxo
    // público. O painel só corta horários já passados (comportamento padrão de getAvailableSlots).
    const slots = await availabilityService.getAvailableSlots(
      session.tenantId,
      professionalId,
      date,
      duration,
      policy.slotIntervalMinutes,
    );

    return Response.json({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}
