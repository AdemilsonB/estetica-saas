import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";

export type TenantEventSetting = {
  enabled: boolean;
  defaultChannels: TeamNotificationChannel[];
};

// Fallback usado quando o tenant ainda não tem uma linha de TenantNotificationSetting
// para o evento (tenants existentes antes desta entrega, ou evento novo no catálogo).
export const SYSTEM_DEFAULT_TENANT_SETTINGS: Record<NotificationEventType, TenantEventSetting> = {
  appointment_created: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
  appointment_cancelled: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
  appointment_rescheduled: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
  appointment_no_show: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
  customer_created: { enabled: true, defaultChannels: ["IN_APP"] },
  appointment_pending_confirmation: { enabled: true, defaultChannels: ["IN_APP"] },
  payment_pending: { enabled: true, defaultChannels: ["IN_APP"] },
  daily_digest: { enabled: true, defaultChannels: ["EMAIL"] },
  birthday_digest: { enabled: true, defaultChannels: ["IN_APP"] },
  customer_inactive: { enabled: true, defaultChannels: ["IN_APP"] },
  agenda_idle: { enabled: true, defaultChannels: ["IN_APP"] },
  monthly_goal: { enabled: true, defaultChannels: ["IN_APP"] },
};

export type RecipientDeliveryPrefs = {
  deliveryMode: string; // "realtime" | "digest"
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

export type ResolvedDelivery = {
  eventEnabled: boolean;
  inApp: boolean;
  email: boolean;
  // Quando não-nulo, o job de e-mail deve enfileirar com este `startAfter`
  // (mesma técnica de "segurar até a janela" usada em appointment-reminder.ts).
  emailStartAfter: Date | null;
};

function isWithinQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function delayUntilQuietHoursEnd(now: Date, hour: number, end: number): Date {
  const hoursUntilEnd = end > hour ? end - hour : 24 - hour + end;
  return new Date(now.getTime() + hoursUntilEnd * 3600_000);
}

export function resolveDelivery(params: {
  eventType: NotificationEventType;
  tenantSetting: TenantEventSetting | null;
  emailOverrideEnabled: boolean | null; // null = sem override, herda o padrão do negócio
  prefs: RecipientDeliveryPrefs;
  now: Date;
}): ResolvedDelivery {
  const { eventType, tenantSetting, emailOverrideEnabled, prefs, now } = params;
  const setting = tenantSetting ?? SYSTEM_DEFAULT_TENANT_SETTINGS[eventType];

  if (!setting.enabled) {
    return { eventEnabled: false, inApp: false, email: false, emailStartAfter: null };
  }

  const inApp = setting.defaultChannels.includes("IN_APP");
  const businessWantsEmail = setting.defaultChannels.includes("EMAIL");
  const userWantsEmail = emailOverrideEnabled ?? businessWantsEmail;
  const emailAllowed = businessWantsEmail && userWantsEmail;

  // Modo digest: nunca sai e-mail por evento individual — entra no resumo diário (Task 14).
  if (!emailAllowed || prefs.deliveryMode === "digest") {
    return { eventEnabled: true, inApp, email: false, emailStartAfter: null };
  }

  let emailStartAfter: Date | null = null;
  if (prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null) {
    const hour = now.getUTCHours();
    if (isWithinQuietHours(hour, prefs.quietHoursStart, prefs.quietHoursEnd)) {
      emailStartAfter = delayUntilQuietHoursEnd(now, hour, prefs.quietHoursEnd);
    }
  }

  return { eventEnabled: true, inApp, email: true, emailStartAfter };
}
