import { NotificationChannel, NotificationStatus } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";

import { notificationRepository } from "./notification.repository";
import { whatsAppProvider } from "./providers/whatsapp.provider";
import type { NotificationDraft } from "./types";

export class NotificationService {
  async logAndDispatch(draft: NotificationDraft) {
    const delivery =
      draft.channel === NotificationChannel.WHATSAPP
        ? await whatsAppProvider.send(draft)
        : { status: NotificationStatus.PENDING, errorMessage: "Canal nao suportado." };

    const notification = await notificationRepository.createLog(draft.tenantId, {
      appointmentId: draft.appointmentId,
      customerId: draft.customerId,
      channel: draft.channel,
      template: draft.template,
      recipient: draft.recipient,
      provider: draft.provider,
      status: delivery.status,
      payload: draft.payload,
      errorMessage: delivery.errorMessage,
    });

    eventBus.publish({
      type: "notifications.notification.logged",
      payload: { tenantId: draft.tenantId, notification },
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
