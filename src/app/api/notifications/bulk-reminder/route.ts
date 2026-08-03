import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { customerMessageDispatcher } from "@/domains/notifications/customer-messages/customer-message-dispatcher.service";

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
        customer: { select: { id: true, phone: true, name: true } },
        service: { select: { name: true } },
      },
    });

    // Só telefone: `appointment_reminder` é transacional, e consentimento de
    // marketing não pode bloquear aviso sobre um horário que o cliente marcou.
    // Quem decide o envio é a guarda do dispatcher.
    const eligible = appointments.filter((a) => a.customer.phone);

    const resultados = await Promise.all(
      eligible.map((a) =>
        customerMessageDispatcher.dispatch({
          tenantId: session.tenantId,
          event: "appointment_reminder",
          appointmentId: a.id,
          customerId: a.customerId,
          recipient: { phone: a.customer.phone, email: null },
          payload: {
            appointmentId: a.id,
            startsAt: a.startsAt.toISOString(),
            customerName: a.customer.name,
            serviceName: a.service?.name ?? "",
          },
        }),
      ),
    );

    const sent = resultados.filter((r) => r.dispatched.length > 0).length;
    // `skipped` inclui o caso "o tenant desligou o lembrete na matriz": a rota não
    // pode reportar como enviado o que o padrão do negócio bloqueou.
    return Response.json({ sent, skipped: resultados.length - sent });
  } catch (error) {
    return handleApiError(error);
  }
}
