import { NotificationStatus } from "@prisma/client";

import type {
  NotificationDeliveryResult,
  NotificationDraft,
} from "../types";

export class WhatsAppProvider {
  async send(draft: NotificationDraft): Promise<NotificationDeliveryResult> {
    void draft;

    return {
      status: NotificationStatus.PENDING,
      errorMessage: "Provider ainda nao configurado.",
    };
  }
}

export const whatsAppProvider = new WhatsAppProvider();
