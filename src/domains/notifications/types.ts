import { NotificationChannel, NotificationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type NotificationDraft = {
  tenantId: string;
  appointmentId?: string;
  customerId?: string;
  channel: NotificationChannel;
  template: string;
  recipient: string;
  provider: string;
  payload: Prisma.InputJsonValue;
};

export type NotificationDeliveryResult = {
  status: NotificationStatus;
  errorMessage?: string;
};
