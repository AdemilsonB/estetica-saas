import type { NotificationEventType, Prisma, UserRole } from "@prisma/client";

export type UserNotificationType =
  | "appointment_created"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "appointment_no_show"
  | "customer_created"
  | "birthday_digest";

export type NotificationPrefs = {
  notifyEmailAppointments: boolean;
  notifyOwnAppointments: boolean;
  notifyTeamAppointments: boolean;
};

export type CreateUserNotificationInput = {
  userId: string;
  type: UserNotificationType;
  title: string;
  body: string;
  data: Prisma.InputJsonValue;
};

export type ManagerRecipient = {
  id: string;
  email: string;
  name: string;
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
} & NotificationPrefs;

export type UserPrefsRow = NotificationPrefs & {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type RecipientContext = {
  role: string;
  notifyOwnAppointments: boolean;
  notifyTeamAppointments: boolean;
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

export type EnrichedAppointment = {
  createdByUserId: string;
  packageId: string | null;
  serviceId: string | null;
  serviceName: string;
  professional: { id: string; name: string; email: string };
};

export type DigestUser = {
  id: string;
  email: string;
  notificationDeliveryMode: string;
};

export type MyNotificationSettings = {
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  // Continua lido direto do User (boolean legado) — o dispatcher usa pra
  // decidir o auto-skip de appointment_created; sem equivalente na tabela
  // nova ainda (ver plano da UI, "Decisão de escopo explícita").
  notifyOwnAppointments: boolean;
  emailOverrides: { eventType: NotificationEventType; enabled: boolean }[];
};

export type UpdateMyNotificationSettingsInput = {
  notificationDeliveryMode?: string;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  notifyOwnAppointments?: boolean;
  emailOverrides?: { eventType: NotificationEventType; enabled: boolean }[];
};
