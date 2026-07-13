import type { UserNotification } from "@prisma/client";

import { userNotificationRepository, UserNotificationRepository } from "./user-notification.repository";
import {
  userNotificationPreferenceRepository,
  UserNotificationPreferenceRepository,
} from "./user-notification-preference.repository";
import type { NotificationPrefs } from "./types";

const EMAIL_OVERRIDE_EVENTS = [
  "appointment_created",
  "appointment_cancelled",
  "appointment_rescheduled",
  "appointment_no_show",
] as const;

export class UserNotificationService {
  constructor(
    private readonly repo: UserNotificationRepository = userNotificationRepository,
    private readonly prefRepo: UserNotificationPreferenceRepository = userNotificationPreferenceRepository,
  ) {}

  async listForUser(
    tenantId: string,
    userId: string,
    opts: { period: "7" | "30" | "all"; limit: number },
  ): Promise<{ items: UserNotification[]; unreadCount: number; isManager: boolean; prefs: NotificationPrefs }> {
    const prefsRow = await this.repo.findUserPrefs(tenantId, userId);
    const since =
      opts.period === "all"
        ? undefined
        : new Date(Date.now() - Number(opts.period) * 24 * 60 * 60 * 1000);

    const [items, unreadCount] = await Promise.all([
      this.repo.findManyForUser(tenantId, userId, { since, limit: opts.limit }),
      this.repo.countUnread(tenantId, userId),
    ]);

    return {
      items,
      unreadCount,
      isManager: prefsRow?.role === "OWNER" || prefsRow?.role === "MANAGER",
      prefs: {
        notifyEmailAppointments: prefsRow?.notifyEmailAppointments ?? false,
        notifyOwnAppointments: prefsRow?.notifyOwnAppointments ?? false,
        notifyTeamAppointments: prefsRow?.notifyTeamAppointments ?? true,
      },
    };
  }

  markRead(tenantId: string, userId: string, arg: { id?: string; all?: boolean }): Promise<number> {
    return this.repo.markRead(tenantId, userId, arg);
  }

  // Mantém o boolean legado (ainda lido pelo dispatcher para notifyOwnAppointments/
  // notifyTeamAppointments — ver "Decisão de escopo explícita" no plano) e, quando
  // notifyEmailAppointments muda, espelha em UserNotificationPreference (dual-write)
  // para que o dispatcher novo (que lê a tabela nova) não fique dessincronizado da
  // UI antiga de 3 switches enquanto a aba nova (próximo plano) não substitui a UI.
  async updatePreferences(
    tenantId: string,
    userId: string,
    prefs: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const updated = await this.repo.updatePrefs(tenantId, userId, prefs);

    if (prefs.notifyEmailAppointments !== undefined) {
      await Promise.all(
        EMAIL_OVERRIDE_EVENTS.map((eventType) =>
          this.prefRepo.upsertEmailOverride(tenantId, userId, eventType, prefs.notifyEmailAppointments!),
        ),
      );
    }

    return updated;
  }
}

export const userNotificationService = new UserNotificationService();
