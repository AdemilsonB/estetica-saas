import { NotificationChannel } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";

import { notificationService } from "./notification.service";

let notificationsRegistered = false;

export function registerNotificationSubscriptions() {
  if (notificationsRegistered) {
    return;
  }

  notificationsRegistered = true;

  eventBus.subscribe("scheduling.appointment.cancelled", async ({ tenantId, appointment, customer, service, notificationMessage }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-cancelled",
      recipient: customer.phone,
      provider: "whatsapp",
      payload: {
        appointmentId: appointment.id,
        status: appointment.status,
        customerName: customer.name,
        serviceName: service.name,
        ...(notificationMessage ? { message: notificationMessage } : {}),
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.created", async ({ tenantId, appointment, customer, service, notificationMessage }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-created",
      recipient: customer.phone,
      provider: "whatsapp",
      payload: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        customerName: customer.name,
        serviceName: service.name,
        ...(notificationMessage ? { message: notificationMessage } : {}),
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.confirmed", async ({ tenantId, appointment, customer, service }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-confirmed",
      recipient: customer.phone,
      provider: "whatsapp",
      payload: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.no_show", async ({ tenantId, appointment, customer, service }) => {
    if (!customer.phone) return;
    await notificationService.logAndDispatch({
      tenantId,
      appointmentId: appointment.id,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-no-show",
      recipient: customer.phone,
      provider: "whatsapp",
      payload: {
        appointmentId: appointment.id,
        status: appointment.status,
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  });

  eventBus.subscribe("scheduling.appointment.rescheduled", async (payload) => {
    if (!payload.customerPhone) return;
    await notificationService.logAndDispatch({
      tenantId: payload.tenantId,
      appointmentId: payload.appointmentId,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-rescheduled",
      recipient: payload.customerPhone,
      provider: "whatsapp",
      payload: {
        message: payload.notificationMessage,
        appointmentId: payload.appointmentId,
        customerName: payload.customerName,
        serviceName: payload.serviceName,
        newStartsAt: payload.newStartsAt.toISOString(),
      },
    });
  });
}
