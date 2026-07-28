import { eventBus } from "@/shared/events/event-bus";

import { customerMessageDispatcher } from "./customer-messages/customer-message-dispatcher.service";

let notificationsRegistered = false;

export function registerNotificationSubscriptions() {
  if (notificationsRegistered) {
    return;
  }

  notificationsRegistered = true;

  eventBus.subscribe(
    "scheduling.appointment.created",
    async ({
      tenantId,
      appointment,
      customer,
      service,
      professional,
      notificationMessage,
      notify,
      origin,
    }) => {
      // Agendamento nascido na vitrine é PEDIDO, não confirmação: o cliente recebe
      // "recebemos seu pedido" e só depois "está confirmado". Pelo painel, o horário
      // já vale como confirmado e só a primeira mensagem existe (spec §6.4).
      const event = origin === "public" ? "appointment_requested" : "appointment_created";

      await customerMessageDispatcher.dispatch({
        tenantId,
        event,
        appointmentId: appointment.id,
        customerId: customer.id,
        recipient: { phone: customer.phone, email: customer.email },
        notifyOverride: notify,
        message: notificationMessage,
        payload: {
          appointmentId: appointment.id,
          startsAt: appointment.startsAt.toISOString(),
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
        },
      });
    },
  );

  eventBus.subscribe(
    "scheduling.appointment.confirmed",
    async ({ tenantId, appointment, customer, service, professional, notificationMessage, notify }) => {
      // Só o pedido nascido online gera "confirmado" para o cliente. Confirmar um
      // agendamento feito no painel não manda segunda mensagem — a menos que o
      // profissional peça explicitamente pelo toggle da ação.
      const nasceuOnline = appointment.origin === "PUBLIC";
      if (!nasceuOnline && notify !== true) return;

      await customerMessageDispatcher.dispatch({
        tenantId,
        event: "appointment_confirmed",
        appointmentId: appointment.id,
        customerId: customer.id,
        recipient: { phone: customer.phone, email: customer.email },
        notifyOverride: notify,
        message: notificationMessage,
        payload: {
          appointmentId: appointment.id,
          startsAt: appointment.startsAt.toISOString(),
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
        },
      });
    },
  );

  eventBus.subscribe(
    "scheduling.appointment.cancelled",
    async ({ tenantId, appointment, customer, service, professional, notificationMessage, notify }) => {
      await customerMessageDispatcher.dispatch({
        tenantId,
        event: "appointment_cancelled",
        appointmentId: appointment.id,
        customerId: customer.id,
        recipient: { phone: customer.phone, email: customer.email },
        notifyOverride: notify,
        message: notificationMessage,
        payload: {
          appointmentId: appointment.id,
          status: appointment.status,
          startsAt: appointment.startsAt.toISOString(),
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
        },
      });
    },
  );

  eventBus.subscribe(
    "scheduling.appointment.no_show",
    async ({ tenantId, appointment, customer, service, professional, notificationMessage, notify }) => {
      await customerMessageDispatcher.dispatch({
        tenantId,
        event: "appointment_no_show",
        appointmentId: appointment.id,
        customerId: customer.id,
        recipient: { phone: customer.phone, email: customer.email },
        notifyOverride: notify,
        message: notificationMessage,
        payload: {
          appointmentId: appointment.id,
          status: appointment.status,
          startsAt: appointment.startsAt.toISOString(),
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
        },
      });
    },
  );

  eventBus.subscribe("scheduling.appointment.rescheduled", async (payload) => {
    await customerMessageDispatcher.dispatch({
      tenantId: payload.tenantId,
      event: "appointment_rescheduled",
      appointmentId: payload.appointmentId,
      customerId: payload.customerId,
      recipient: { phone: payload.customerPhone, email: payload.customerEmail },
      notifyOverride: payload.notify,
      message: payload.notificationMessage || undefined,
      payload: {
        appointmentId: payload.appointmentId,
        customerName: payload.customerName,
        serviceName: payload.serviceName,
        professionalName: payload.professionalName,
        // `newStartsAt` tem precedência sobre `startsAt` no gateway — é a data nova
        // que o cliente precisa ler.
        newStartsAt: payload.newStartsAt.toISOString(),
      },
    });
  });
}
