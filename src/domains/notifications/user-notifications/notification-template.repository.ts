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

  async upsert(
    tenantId: string,
    eventType: NotificationEventType,
    channel: TeamNotificationChannel,
    data: { subject: string | null; body: string },
  ): Promise<NotificationTemplate> {
    return prisma.notificationTemplate.upsert({
      where: { tenantId_eventType_channel: { tenantId, eventType, channel } },
      update: data,
      create: { tenantId, eventType, channel, ...data },
    });
  }
}

export const notificationTemplateRepository = new NotificationTemplateRepository();
