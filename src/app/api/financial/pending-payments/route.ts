import { AppointmentPaymentStatus } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.view);

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: session.tenantId,
        paymentStatus: { in: [AppointmentPaymentStatus.PENDING, AppointmentPaymentStatus.DEBT] },
        status: "COMPLETED",
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: "desc" },
    });

    return Response.json(appointments);
  } catch (error) {
    return handleApiError(error);
  }
}
