import type { UserNotification } from "@prisma/client";

import { userNotificationRepository, UserNotificationRepository } from "./user-notification.repository";
import {
  userNotificationPreferenceRepository,
  UserNotificationPreferenceRepository,
} from "./user-notification-preference.repository";
import type { MyNotificationSettings, NotificationPrefs, UpdateMyNotificationSettingsInput } from "./types";

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
      try {
        await Promise.all(
          EMAIL_OVERRIDE_EVENTS.map((eventType) =>
            this.prefRepo.upsertEmailOverride(tenantId, userId, eventType, prefs.notifyEmailAppointments!),
          ),
        );
      } catch (err) {
        // Dual-write é best-effort: o boolean legado (escrita primária) já foi salvo
        // acima. Falhar aqui derrubaria a resposta da API mesmo com o save já concluído.
        console.error("[user-notifications] falha no dual-write de UserNotificationPreference:", err);
      }
    }

    return updated;
  }

  async getMyNotificationSettings(tenantId: string, userId: string): Promise<MyNotificationSettings> {
    const [deliveryPrefs, overrides] = await Promise.all([
      this.repo.findDeliveryPrefs(tenantId, userId),
      this.prefRepo.findAllForUser(tenantId, userId),
    ]);
    return {
      notificationDeliveryMode: deliveryPrefs?.notificationDeliveryMode ?? "realtime",
      quietHoursStart: deliveryPrefs?.quietHoursStart ?? null,
      quietHoursEnd: deliveryPrefs?.quietHoursEnd ?? null,
      emailOverrides: overrides
        .filter((o) => o.channel === "EMAIL")
        .map((o) => ({ eventType: o.eventType, enabled: o.enabled })),
    };
  }

  async updateMyNotificationSettings(
    tenantId: string,
    userId: string,
    input: UpdateMyNotificationSettingsInput,
  ): Promise<void> {
    const { notificationDeliveryMode, quietHoursStart, quietHoursEnd, emailOverrides } = input;
    const tasks: Promise<unknown>[] = [];

    if (notificationDeliveryMode !== undefined || quietHoursStart !== undefined || quietHoursEnd !== undefined) {
      tasks.push(
        this.repo.updateDeliveryPrefs(tenantId, userId, { notificationDeliveryMode, quietHoursStart, quietHoursEnd }),
      );
    }
    if (emailOverrides) {
      for (const o of emailOverrides) {
        tasks.push(this.prefRepo.upsertEmailOverride(tenantId, userId, o.eventType, o.enabled));
      }
    }

    await Promise.all(tasks);
  }
}

export const userNotificationService = new UserNotificationService();
