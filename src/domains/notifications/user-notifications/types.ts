import type { Prisma, UserRole } from "@prisma/client";

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
} & NotificationPrefs;

export type UserPrefsRow = NotificationPrefs & {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};
