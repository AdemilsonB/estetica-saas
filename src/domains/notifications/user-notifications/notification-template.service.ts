import type { NotificationEventType, NotificationTemplate, TeamNotificationChannel } from "@prisma/client";

import {
  notificationTemplateRepository,
  NotificationTemplateRepository,
} from "./notification-template.repository";
import { getSystemTemplate } from "./system-default-templates";

export type TemplateDTO = { subject: string | null; body: string; isSystemDefault: boolean };

export class NotificationTemplateService {
  constructor(
    private readonly repo: NotificationTemplateRepository = notificationTemplateRepository,
  ) {}

  async getForTenant(
    tenantId: string,
    eventType: NotificationEventType,
    channel: TeamNotificationChannel,
  ): Promise<TemplateDTO | null> {
    const row = await this.repo.findByTenant(tenantId, eventType, channel);
    if (row) return { subject: row.subject, body: row.body, isSystemDefault: false };

    const fallback = getSystemTemplate(eventType, channel);
    return fallback ? { ...fallback, isSystemDefault: true } : null;
  }

  upsert(
    tenantId: string,
    eventType: NotificationEventType,
    channel: TeamNotificationChannel,
    data: { subject: string | null; body: string },
  ): Promise<NotificationTemplate> {
    return this.repo.upsert(tenantId, eventType, channel, data);
  }
}

export const notificationTemplateService = new NotificationTemplateService();
