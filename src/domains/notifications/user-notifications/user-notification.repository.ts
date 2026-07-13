import type { Prisma, UserNotification } from "@prisma/client";
import { UserRole } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import type {
  CreateUserNotificationInput,
  DigestUser,
  EnrichedAppointment,
  ManagerRecipient,
  NotificationPrefs,
  RecipientContext,
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
        notificationDeliveryMode: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    });
  }

  async findTenantName(tenantId: string): Promise<string | null> {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });
    return tenant?.name ?? null;
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

  async findRecipientContext(tenantId: string, userId: string): Promise<RecipientContext | null> {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        role: true,
        notifyOwnAppointments: true,
        notifyTeamAppointments: true,
        notificationDeliveryMode: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    });
  }

  async findTenantTimezone(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { timezone: true } });
    return tenant?.timezone ?? "America/Sao_Paulo";
  }

  async findAppointmentForNotification(
    tenantId: string,
    appointmentId: string,
  ): Promise<EnrichedAppointment | null> {
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        professional: { select: { id: true, name: true, email: true } },
        service: { select: { id: true, name: true } },
      },
    });
    if (!appt) return null;
    return {
      createdByUserId: appt.createdByUserId,
      packageId: appt.packageId,
      serviceId: appt.service?.id ?? null,
      serviceName: appt.service?.name ?? "",
      professional: appt.professional,
    };
  }

  async findPendingWorklist(
    tenantId: string,
    userId: string,
  ): Promise<{ appointmentsAwaitingConfirmation: number; paymentsPending: number }> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [appointmentsAwaitingConfirmation, paymentsPending] = await Promise.all([
      prisma.appointment.count({
        where: { tenantId, professionalId: userId, startsAt: { gte: start, lte: end }, status: "SCHEDULED" },
      }),
      prisma.appointment.count({
        where: { tenantId, professionalId: userId, paymentStatus: "PENDING", status: "COMPLETED" },
      }),
    ]);

    return { appointmentsAwaitingConfirmation, paymentsPending };
  }

  async findAllForDigest(tenantId: string): Promise<DigestUser[]> {
    return prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, notificationDeliveryMode: true },
    });
  }

  async countTodayAppointmentsFor(tenantId: string, professionalId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return prisma.appointment.count({
      where: { tenantId, professionalId, startsAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
    });
  }

  async findTodayForDigest(tenantId: string, userId: string): Promise<{ type: string }[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return prisma.userNotification.findMany({
      where: { tenantId, userId, createdAt: { gte: start } },
      select: { type: true },
    });
  }
}

export const userNotificationRepository = new UserNotificationRepository();
