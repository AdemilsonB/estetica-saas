import type { NotificationEventType, TeamNotificationChannel, TenantNotificationSetting } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class TenantNotificationSettingRepository {
  async findByTenant(
    tenantId: string,
    eventType: NotificationEventType,
  ): Promise<TenantNotificationSetting | null> {
    return prisma.tenantNotificationSetting.findFirst({
      where: { tenantId, eventType },
    });
  }

  async findAllByTenant(tenantId: string): Promise<TenantNotificationSetting[]> {
    return prisma.tenantNotificationSetting.findMany({ where: { tenantId } });
  }

  async upsert(
    tenantId: string,
    eventType: NotificationEventType,
    data: { enabled: boolean; defaultChannels: TeamNotificationChannel[] },
  ): Promise<TenantNotificationSetting> {
    return prisma.tenantNotificationSetting.upsert({
      where: { tenantId_eventType: { tenantId, eventType } },
      update: data,
      create: { tenantId, eventType, ...data },
    });
  }
}

export const tenantNotificationSettingRepository = new TenantNotificationSettingRepository();
