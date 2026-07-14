import type { NotificationEventType, TeamNotificationChannel, TenantNotificationSetting } from "@prisma/client";

import { TEAM_NOTIFICATION_CATALOG } from "./team-notification-catalog";
import {
  tenantNotificationSettingRepository,
  TenantNotificationSettingRepository,
} from "./tenant-notification-setting.repository";
import { SYSTEM_DEFAULT_TENANT_SETTINGS } from "./notification-channel-resolver";

export type BusinessEventSettingDTO = {
  eventType: NotificationEventType;
  label: string;
  description: string;
  supportsEmail: boolean;
  enabled: boolean;
  defaultChannels: TeamNotificationChannel[];
};

export class TeamNotificationSettingsService {
  constructor(
    private readonly repo: TenantNotificationSettingRepository = tenantNotificationSettingRepository,
  ) {}

  async listForTenant(tenantId: string): Promise<BusinessEventSettingDTO[]> {
    const rows = await this.repo.findAllByTenant(tenantId);
    const byEvent = new Map(rows.map((r) => [r.eventType, r]));

    return TEAM_NOTIFICATION_CATALOG.map((entry) => {
      const row = byEvent.get(entry.eventType);
      const fallback = SYSTEM_DEFAULT_TENANT_SETTINGS[entry.eventType];
      return {
        eventType: entry.eventType,
        label: entry.label,
        description: entry.description,
        supportsEmail: entry.supportsEmail,
        enabled: row?.enabled ?? fallback.enabled,
        defaultChannels: row?.defaultChannels ?? fallback.defaultChannels,
      };
    });
  }

  updateEvent(
    tenantId: string,
    eventType: NotificationEventType,
    data: { enabled: boolean; defaultChannels: TeamNotificationChannel[] },
  ): Promise<TenantNotificationSetting> {
    return this.repo.upsert(tenantId, eventType, data);
  }
}

export const teamNotificationSettingsService = new TeamNotificationSettingsService();
