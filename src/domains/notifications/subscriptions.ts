import { NotificationChannel, TransactionType } from "@prisma/client";

import { financialService } from "@/domains/financial/financial.service";
import { eventBus } from "@/shared/events/event-bus";

import { notificationService } from "./notification.service";

let notificationsRegistered = false;

export function registerNotificationSubscriptions() {
  if (notificationsRegistered) {
    return;
  }

  notificationsRegistered = true;

  eventBus.subscribe("scheduling.appointment.cancelled", async ({ tenantId, appointment, customer, service }) => {
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-cancelled",
      recipient: customer.phone ?? customer.email ?? "",
      provider: "evolution-api",
      payload: {
        appointmentId: appointment.id,
        status: appointment.status,
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.created", async ({ tenantId, appointment, customer, service }) => {
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-created",
      recipient: customer.phone ?? customer.email ?? "",
      provider: "evolution-api",
      payload: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.no_show", async ({ tenantId, appointment, customer, service }) => {
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-no-show",
      recipient: customer.phone ?? customer.email ?? "",
      provider: "evolution-api",
      payload: {
        appointmentId: appointment.id,
        status: appointment.status,
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.completed", async ({ tenantId, appointment }) => {
    await financialService.create(tenantId, {
      appointmentId: appointment.id,
      type: TransactionType.INCOME,
      category: "service",
      description: "Receita gerada automaticamente a partir de agendamento concluido.",
      amount: Number(appointment.price),
      paidAt: new Date().toISOString(),
    });
  });
}
