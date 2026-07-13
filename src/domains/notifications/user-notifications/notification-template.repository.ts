import type { NotificationEventType, NotificationTemplate, TeamNotificationChannel } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class NotificationTemplateRepository {
  async findByTenant(
    tenantId: string,
    eventType: NotificationEventType,
    channel: TeamNotificationChannel,
  ): Promise<NotificationTemplate | null> {
    return prisma.notificationTemplate.findFirst({
      where: { tenantId, eventType, channel },
    });
  }
}

export const notificationTemplateRepository = new NotificationTemplateRepository();
