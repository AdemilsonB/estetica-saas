import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { eventBus } from "@/shared/events/event-bus";
import { notificationRepository } from "./notification.repository";
import { whatsAppGateway } from "./providers/whatsapp.gateway";
import { EmailProvider } from "./providers/email.provider";
import {
  bookingConfirmedHtml,
  bookingReminderHtml,
  bookingCancelledHtml,
} from "./providers/email-templates";
import type { NotificationDraft, NotificationDeliveryResult } from "./types";

const EMAIL_SUBJECTS: Record<string, string> = {
  "appointment-created": "Agendamento confirmado",
  "appointment-reminder": "Lembrete: seu agendamento é amanhã",
  "appointment-cancelled": "Agendamento cancelado",
};

function buildEmailHtml(template: string, payload: Record<string, unknown>): string {
  const data = {
    customerName: String(payload.customerName ?? "Cliente"),
    serviceName: String(payload.serviceName ?? "Serviço"),
    professionalName: payload.professionalName ? String(payload.professionalName) : undefined,
    dateTime: String(payload.dateTime ?? ""),
    tenantName: String(payload.tenantName ?? "Estabelecimento"),
    tenantPhone: payload.tenantPhone ? String(payload.tenantPhone) : undefined,
  };
  if (template === "appointment-created") return bookingConfirmedHtml(data);
  if (template === "appointment-reminder") return bookingReminderHtml(data);
  if (template === "appointment-cancelled") return bookingCancelledHtml(data);
  return `<p>${data.customerName}, você tem uma notificação de ${data.tenantName}.</p>`;
}

export class NotificationService {
  async logAndDispatch(draft: NotificationDraft) {
    let delivery: NotificationDeliveryResult;

    if (draft.channel === NotificationChannel.WHATSAPP) {
      delivery = await whatsAppGateway.send(draft);
    } else if (draft.channel === NotificationChannel.EMAIL) {
      const subject = EMAIL_SUBJECTS[draft.template] ?? "Notificação";
      const html = buildEmailHtml(draft.template, draft.payload as Record<string, unknown>);
      const emailProvider = new EmailProvider();
      delivery = await emailProvider.send({ to: draft.recipient, subject, html });
    } else {
      delivery = { status: NotificationStatus.FAILED, errorMessage: "Canal não suportado." };
    }

    const notification = await notificationRepository.createLog(draft.tenantId, {
      appointmentId: draft.appointmentId,
      customerId: draft.customerId,
      channel: draft.channel,
      template: draft.template,
      recipient: draft.recipient,
      provider: delivery.provider ?? draft.provider,
      status: delivery.status,
      payload: draft.payload,
      errorMessage: delivery.errorMessage,
      externalId: delivery.externalId,
    });

    eventBus.publish({
      type: "notifications.notification.logged",
      payload: { tenantId: draft.tenantId, notification },
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
