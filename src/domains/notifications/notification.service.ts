import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { eventBus } from "@/shared/events/event-bus";
import { featureGuard } from "@/domains/billing/feature-guard";
import { notificationRepository } from "./notification.repository";
import { whatsAppGateway } from "./providers/whatsapp.gateway";
import { getEmailProvider } from "./providers/email.provider";
import { customerEmailHtml } from "./providers/email-templates";
import { customerMessageService } from "./customer-messages/customer-message.service";
import { LEGACY_TEMPLATE_TO_EVENT } from "./customer-messages/customer-message-catalog";
import type { NotificationDraft, NotificationDeliveryResult } from "./types";

export class NotificationService {
  async logAndDispatch(draft: NotificationDraft) {
    let delivery: NotificationDeliveryResult;

    if (draft.channel === NotificationChannel.WHATSAPP) {
      delivery = await whatsAppGateway.send(draft);
    } else if (draft.channel === NotificationChannel.EMAIL) {
      // DÉBITO TÉCNICO: este assertWithinLimit lança PlanLimitError (402) ao exceder a cota.
      // Hoje `logAndDispatch` só é chamado no caminho HTTP para EMAIL (nenhum job pg-boss usa
      // canal EMAIL). Se algum job passar a enviar e-mail (ex.: automação/campanhas da Fase 2),
      // o 402 propagado FARÁ O JOB FALHAR em vez de virar upsell — nesse caso, tratar o limite
      // no contexto do job (catch/skip silencioso + log), não deixar propagar.
      const emailCount = await notificationRepository.countEmailsThisMonth(draft.tenantId);
      await featureGuard.assertWithinLimit(draft.tenantId, "email_month", emailCount);

      const event = LEGACY_TEMPLATE_TO_EVENT[draft.template];
      if (!event) {
        delivery = {
          status: NotificationStatus.FAILED,
          errorMessage: `Template desconhecido: ${draft.template}`,
        };
      } else {
        const tenant = await prisma.tenant.findFirst({
          where: { id: draft.tenantId },
          select: { name: true, slug: true, timezone: true, phone: true, address: true },
        });

        const payload = draft.payload as {
          customerName?: string;
          serviceName?: string;
          professionalName?: string;
          startsAt?: string;
        };

        const rendered = await customerMessageService.render(draft.tenantId, event, "EMAIL", {
          customerName: payload.customerName ?? "Cliente",
          serviceName: payload.serviceName,
          professionalName: payload.professionalName,
          startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
          tenant: {
            name: tenant?.name ?? "Estabelecimento",
            slug: tenant?.slug ?? "",
            timezone: tenant?.timezone ?? "America/Sao_Paulo",
            phone: tenant?.phone,
            address: tenant?.address,
          },
        });

        delivery = await getEmailProvider().send({
          to: draft.recipient,
          subject: rendered.subject ?? "Notificação",
          html: customerEmailHtml({
            body: rendered.text,
            tenantName: tenant?.name ?? "Estabelecimento",
          }),
        });
      }
    } else {
      delivery = { status: NotificationStatus.FAILED, errorMessage: "Canal não suportado." };
    }

    const notification = await notificationRepository.createLog(draft.tenantId, {
      appointmentId: draft.appointmentId,
      customerId: draft.customerId,
      channel: draft.channel,
      template: draft.template,
      recipient: draft.recipient,
      provider: delivery.provider ?? draft.provider ?? "gateway",
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
