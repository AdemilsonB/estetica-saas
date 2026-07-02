import { NotificationChannel } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { notificationService } from "@/domains/notifications/notification.service";

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: session.tenantId,
        startsAt: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["CANCELLED"] },
      },
      include: {
        customer: { select: { id: true, phone: true, name: true, consentGiven: true } },
        service: { select: { name: true } },
      },
    });

    const eligible = appointments.filter(
      (a) => a.customer.phone && a.customer.consentGiven,
    );

    await Promise.all(
      eligible.map((a) =>
        notificationService.logAndDispatch({
          tenantId: session.tenantId,
          appointmentId: a.id,
          customerId: a.customerId,
          channel: NotificationChannel.WHATSAPP,
          template: "appointment-reminder",
          recipient: a.customer.phone!,
          payload: {
            appointmentId: a.id,
            startsAt: a.startsAt.toISOString(),
            customerName: a.customer.name,
            serviceName: a.service?.name ?? "",
          },
        }),
      ),
    );

    return Response.json({ sent: eligible.length });
  } catch (error) {
    return handleApiError(error);
  }
}
