import type { NotificationEventType, TenantNotificationSetting } from "@prisma/client";

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
}

export const tenantNotificationSettingRepository = new TenantNotificationSettingRepository();
