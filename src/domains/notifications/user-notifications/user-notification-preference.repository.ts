import type { NotificationEventType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class UserNotificationPreferenceRepository {
  // Batelada: uma única query para todos os candidatos de um evento (evita
  // fan-out de N queries por destinatário, mitigação exigida pelo spec).
  async findEmailOverridesForUsers(
    tenantId: string,
    userIds: string[],
    eventType: NotificationEventType,
  ): Promise<Map<string, boolean>> {
    if (userIds.length === 0) return new Map();
    const rows = await prisma.userNotificationPreference.findMany({
      where: { tenantId, userId: { in: userIds }, eventType, channel: "EMAIL" },
      select: { userId: true, enabled: true },
    });
    return new Map(rows.map((r) => [r.userId, r.enabled]));
  }

  async upsertEmailOverride(
    tenantId: string,
    userId: string,
    eventType: NotificationEventType,
    enabled: boolean,
  ): Promise<void> {
    await prisma.userNotificationPreference.upsert({
      where: {
        tenantId_userId_eventType_channel: { tenantId, userId, eventType, channel: "EMAIL" },
      },
      update: { enabled },
      create: { tenantId, userId, eventType, channel: "EMAIL", enabled },
    });
  }
}

export const userNotificationPreferenceRepository = new UserNotificationPreferenceRepository();
