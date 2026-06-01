import { NotificationChannel, NotificationStatus } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";

import { notificationRepository } from "./notification.repository";
import { whatsAppGateway } from "./providers/whatsapp.gateway";
import type { NotificationDraft, NotificationDeliveryResult } from "./types";

export class NotificationService {
  async logAndDispatch(draft: NotificationDraft) {
    const delivery: NotificationDeliveryResult =
      draft.channel === NotificationChannel.WHATSAPP
        ? await whatsAppGateway.send(draft)
        : { status: NotificationStatus.PENDING, errorMessage: "Canal nao suportado." };

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
