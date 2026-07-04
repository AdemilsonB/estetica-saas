import type { Prisma, UserNotification } from "@prisma/client";
import { UserRole } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import type {
  CreateUserNotificationInput,
  ManagerRecipient,
  NotificationPrefs,
  UserPrefsRow,
} from "./types";

export class UserNotificationRepository {
  async createMany(tenantId: string, rows: CreateUserNotificationInput[]): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await prisma.userNotification.createMany({
      data: rows.map((r) => ({ ...r, tenantId })),
    });
    return result.count;
  }

  async findManyForUser(
    tenantId: string,
    userId: string,
    opts: { since?: Date; limit: number },
  ): Promise<UserNotification[]> {
    const where: Prisma.UserNotificationWhereInput = {
      tenantId,
      userId,
      ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
    };
    return prisma.userNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
    });
  }

  async countUnread(tenantId: string, userId: string): Promise<number> {
    return prisma.userNotification.count({
      where: { tenantId, userId, readAt: null },
    });
  }

  async markRead(
    tenantId: string,
    userId: string,
    arg: { id?: string; all?: boolean },
  ): Promise<number> {
    const where: Prisma.UserNotificationWhereInput = {
      tenantId,
      userId,
      readAt: null,
      ...(arg.id ? { id: arg.id } : {}),
    };
    const result = await prisma.userNotification.updateMany({
      where,
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async findManagers(tenantId: string): Promise<ManagerRecipient[]> {
    return prisma.user.findMany({
      where: { tenantId, role: { in: [UserRole.OWNER, UserRole.MANAGER] } },
      select: {
        id: true,
        email: true,
        name: true,
        notifyEmailAppointments: true,
        notifyOwnAppointments: true,
        notifyTeamAppointments: true,
      },
    });
  }

  async findUserPrefs(tenantId: string, userId: string): Promise<UserPrefsRow | null> {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        notifyEmailAppointments: true,
        notifyOwnAppointments: true,
        notifyTeamAppointments: true,
      },
    });
  }

  async updatePrefs(
    tenantId: string,
    userId: string,
    prefs: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const updated = await prisma.user.update({
      where: { id: userId, tenantId },
      data: prefs,
      select: {
        notifyEmailAppointments: true,
        notifyOwnAppointments: true,
        notifyTeamAppointments: true,
      },
    });
    return updated;
  }
}

export const userNotificationRepository = new UserNotificationRepository();
